import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { isExpired } from '@/lib/tickets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { db } = await connectToDatabase()
    const booking = await db.collection('bookings').findOne({ bookingCode: params.code })

    if (!booking) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
    }

    if (booking.status === 'confirmed' && isExpired(booking.validUntil)) {
      await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { status: 'expired' } })
      booking.status = 'expired'
    }

    const expired = booking.status === 'expired' || isExpired(booking.validUntil)
    const unpaid = booking.paymentStatus !== 'paid'
    const valid = !expired && !unpaid && booking.status === 'confirmed'

    return NextResponse.json({
      valid,
      reason: unpaid ? 'unpaid' : expired ? 'expired' : booking.status !== 'confirmed' ? booking.status : undefined,
      bookingCode: booking.bookingCode,
      passengerName: booking.passengerName,
      busName: booking.busName,
      companyName: booking.companyName,
      from: booking.from,
      to: booking.to,
      date: booking.date,
      departureTime: booking.departureTime,
      seats: booking.seats,
      validUntil: booking.validUntil,
      checkedIn: !!booking.checkedIn,
      checkedInAt: booking.checkedInAt,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to verify ticket' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { db } = await connectToDatabase()
    const booking = await db.collection('bookings').findOne({ bookingCode: params.code })

    if (!booking) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    if (booking.paymentStatus !== 'paid' || booking.status !== 'confirmed' || isExpired(booking.validUntil)) {
      return NextResponse.json({ error: 'Ticket is not valid for boarding' }, { status: 409 })
    }
    if (booking.checkedIn) {
      return NextResponse.json({ error: 'Ticket already checked in', checkedInAt: booking.checkedInAt }, { status: 409 })
    }

    const checkedInAt = new Date().toISOString()
    await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { checkedIn: true, checkedInAt } })
    return NextResponse.json({ success: true, checkedInAt })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to check in ticket' }, { status: 500 })
  }
}
