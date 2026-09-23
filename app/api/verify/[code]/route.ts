import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { isExpired, ticketExpiry } from '@/lib/tickets'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'

export const dynamic = 'force-dynamic'

/**
 * Public, read-only check behind the ticket's QR code: anyone who scans it with a phone
 * camera lands here. Boarding a passenger happens only in the operator scanner (/api/scan),
 * because a check-in open to anyone would let a passenger, or a stranger with the code,
 * burn a ticket before it reaches the bus.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { db } = await connectToDatabase()
    await repairWronglyExpiredTickets(db, { bookingCode: params.code })
    const booking = await db.collection('bookings').findOne({ bookingCode: params.code })

    if (!booking) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
    }

    const validUntil = ticketExpiry(booking.date)
    const unpaid = booking.paymentStatus !== 'paid'
    const expired = !unpaid && isExpired(validUntil)
    const valid = !unpaid && !expired && booking.status === 'confirmed'

    return NextResponse.json({
      valid,
      reason: unpaid ? 'unpaid' : booking.status !== 'confirmed' ? booking.status : expired ? 'expired' : undefined,
      bookingCode: booking.bookingCode,
      passengerName: booking.passengerName,
      busName: booking.busName,
      companyName: booking.companyName,
      from: booking.from,
      to: booking.to,
      date: booking.date,
      departureTime: booking.departureTime,
      seats: booking.seats,
      validUntil,
      checkedIn: !!booking.checkedIn,
      checkedInAt: booking.checkedInAt,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to verify ticket' }, { status: 500 })
  }
}
