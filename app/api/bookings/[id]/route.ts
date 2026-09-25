import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { isExpired, getVerifyUrl, ticketExpiry } from '@/lib/tickets'
import { releaseExpiredHolds, repairWronglyExpiredTickets } from '@/lib/seatHold'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

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

    const verifyUrl = getVerifyUrl(booking.bookingCode)
    sendWhatsAppMessage(
      booking.passengerPhone,
      `Your BusHub ticket is confirmed!\nBooking: ${booking.bookingCode}\n${booking.busName} (${booking.companyName})\n${booking.from} to ${booking.to}\nDate: ${booking.date} ${booking.departureTime}\nSeats: ${booking.seats.join(', ')}\nTotal: ৳${booking.totalPrice}\n\nShow this to the conductor:\n${verifyUrl}\n\nOne ticket boards once. Don't share your QR code.`
    ).catch(() => {})

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
