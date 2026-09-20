import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { isExpired, getVerifyUrl } from '@/lib/tickets'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

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

    if (booking.status === 'confirmed' && isExpired(booking.validUntil)) {
      await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { status: 'expired' } })
      booking.status = 'expired'
    }

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
    await db.collection('bookings').updateOne(query, { $set: { paymentStatus, paymentMethod } })
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
