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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { paymentStatus, paymentMethod } = body
    if (!paymentStatus) {
      return NextResponse.json({ error: 'Missing paymentStatus' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id)
      ? { _id: new ObjectId(params.id) }
      : { bookingCode: params.id }

    const before = await db.collection('bookings').findOne(query)
    if (!before) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (paymentStatus === 'paid') {
      if (before.status === 'expired' || (before.holdExpiresAt && isExpired(before.holdExpiresAt) && before.status === 'pending')) {
        await releaseExpiredHolds(db, before.busId)
        return NextResponse.json(
          { error: 'This booking hold has expired. Please search and select seats again.' },
          { status: 410 }
        )
      }
    }

    const update: Record<string, any> = { paymentStatus, paymentMethod }
    if (paymentStatus === 'paid') update.status = 'confirmed'

    await db.collection('bookings').updateOne(query, { $set: update })
    const booking = await db.collection('bookings').findOne(query)

    if (booking && before?.paymentStatus !== 'paid' && paymentStatus === 'paid') {
      const verifyUrl = getVerifyUrl(booking.bookingCode)
      sendWhatsAppMessage(
        booking.passengerPhone,
        `Your BusHub ticket is confirmed!\nBooking: ${booking.bookingCode}\n${booking.from} to ${booking.to}\nDate: ${booking.date} ${booking.departureTime}\nSeats: ${booking.seats.join(', ')}\nTotal: ৳${booking.totalPrice}\n\nShow this to the conductor:\n${verifyUrl}\n\nValid for 24 hours.`
      ).catch(() => {})
    }

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
