import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { isExpired, ticketExpiry } from '@/lib/tickets'
import { releaseExpiredHolds, repairWronglyExpiredTickets } from '@/lib/seatHold'
import { deliverNewTicket, type DeliverableTicket } from '@/lib/ticketDelivery'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id)
      ? { _id: new ObjectId(params.id) }
      : { bookingCode: params.id }

    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'pending' && booking.holdExpiresAt && isExpired(booking.holdExpiresAt)) {
      await releaseExpiredHolds(db, booking.busId)
      booking.status = 'expired'
    } else if (booking.paymentStatus === 'paid' && booking.status === 'expired') {
      await repairWronglyExpiredTickets(db, { _id: booking._id })
      booking.status = 'confirmed'
    }

    // Validity is derived from the travel date, not the stored value, which older bookings
    // have set to 24 hours after purchase.
    if (booking.date) booking.validUntil = ticketExpiry(booking.date)

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

const PAYMENT_METHODS = ['bkash', 'nagad', 'card']

/**
 * Marks an unpaid hold as paid. It works once, only while the 10-minute hold is still running,
 * and only in that direction: a paid ticket can never be switched back to unpaid. The check and
 * the change are a single database update, so a hold can't expire and be paid at the same time.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const { paymentStatus, paymentMethod } = body || {}
    if (paymentStatus !== 'paid') {
      return NextResponse.json({ error: 'Only a payment can be recorded here' }, { status: 400 })
    }
    const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : undefined

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id)
      ? { _id: new ObjectId(params.id) }
      : { bookingCode: params.id }

    const paidAt = new Date().toISOString()
    const result = await db.collection('bookings').updateOne(
      { ...query, status: 'pending', paymentStatus: 'pending', holdExpiresAt: { $gt: paidAt } },
      { $set: { paymentStatus: 'paid', status: 'confirmed', paymentMethod: method, paidAt } }
    )
    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (result.modifiedCount === 0) {
      // Paying twice (a double tap, a retry) just returns the ticket.
      if (booking.paymentStatus === 'paid') return NextResponse.json({ booking })
      if (booking.status === 'pending' || booking.status === 'expired') {
        await releaseExpiredHolds(db, booking.busId)
        return NextResponse.json(
          { error: 'This booking hold has expired. Please search and select seats again.' },
          { status: 410 }
        )
      }
      return NextResponse.json({ error: 'This booking can no longer be paid' }, { status: 409 })
    }

    // The ticket goes straight to the passenger's email and WhatsApp, so a ticket that was never
    // downloaded is still safe in their inbox. Waited for (with a limit) because the server may stop
    // once the reply is sent; what was sent is recorded so the ticket page can say so.
    const sent = await Promise.race([
      deliverNewTicket(booking as unknown as DeliverableTicket).catch(() => ({ email: false, whatsapp: false })),
      new Promise<{ email: boolean; whatsapp: boolean }>((resolve) => setTimeout(() => resolve({ email: false, whatsapp: false }), 6000)),
    ])
    if (sent.email || sent.whatsapp) {
      const at = new Date().toISOString()
      const stamp = { ...(sent.email ? { ticketEmailedAt: at } : {}), ...(sent.whatsapp ? { ticketWhatsappedAt: at } : {}) }
      await db.collection('bookings').updateOne({ _id: booking._id }, { $set: stamp })
      Object.assign(booking, stamp)
    }

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

/**
 * The admin deletes a booking (a test, a mistake). The booking is moved to an archive rather
 * than wiped, and any seats it still holds go back on sale. A ticket already in a payout invoice
 * stays: the invoice has to be cancelled first, so the money record never loses a line.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can delete bookings' }, { status: 403 })
    }
    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id) ? { _id: new ObjectId(params.id) } : { bookingCode: params.id }
    const booking = await db.collection('bookings').findOne(query)
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.payoutId) {
      const invoice = ObjectId.isValid(booking.payoutId) ? await db.collection('payouts').findOne({ _id: new ObjectId(booking.payoutId) }) : null
      return NextResponse.json(
        { error: `This ticket is in payout invoice ${invoice?.number || ''} to the bus company. Cancel that invoice first, or keep the ticket.` },
        { status: 409 }
      )
    }
    const deletedAt = new Date().toISOString()
    await db.collection('deletedBookings').insertOne({ ...booking, deletedAt, deletedBy: 'BusHub admin' })
    const result = await db.collection('bookings').deleteOne({ _id: booking._id, payoutId: { $exists: false } })
    if (result.deletedCount === 0) {
      await db.collection('deletedBookings').deleteOne({ _id: booking._id, deletedAt })
      return NextResponse.json({ error: 'This booking just changed. Reload and try again.' }, { status: 409 })
    }
    // A live hold or a paid ticket still holds its seats on the bus; give them back.
    if ((booking.status === 'pending' || booking.status === 'confirmed') && ObjectId.isValid(booking.busId)) {
      await db
        .collection('buses')
        .updateOne({ _id: new ObjectId(booking.busId) }, { $pull: { bookedSeats: { $in: booking.seats || [] } } } as any)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete the booking' }, { status: 500 })
  }
}
