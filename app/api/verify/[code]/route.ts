import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { isExpired, ticketExpiry } from '@/lib/tickets'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { isCounterCode } from '@/lib/scan'

/** Codes matching no ticket that one connection may check in ten minutes. Kept generous:
 * mobile networks put many phones behind one address. */
const VERIFY_MISS_LIMIT = 60

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
    const missKey = `verify:${clientIp(req.headers)}`
    if (await tooManyMisses(db, missKey, VERIFY_MISS_LIMIT)) {
      return NextResponse.json({ valid: false, reason: 'too_many' }, { status: 429 })
    }
    // A ticket printed at a bus company's counter: genuine or cancelled, with the trip. Only the
    // passenger's first name is shown to whoever scans it.
    if (isCounterCode(params.code)) {
      const ct = await db.collection('counterTickets').findOne({ ticketCode: params.code.toUpperCase() })
      if (!ct) {
        await recordMiss(db, missKey)
        return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
      }
      const validUntil = ticketExpiry(ct.date)
      const expired = isExpired(validUntil)
      const cancelled = ct.status === 'cancelled'
      return NextResponse.json({
        valid: !cancelled && !expired,
        reason: cancelled ? 'cancelled' : expired ? 'expired' : undefined,
        bookingCode: ct.ticketCode,
        passengerName: String(ct.passengerName || 'Counter passenger').split(' ')[0],
        busName: ct.busName,
        companyName: ct.companyName,
        from: ct.from,
        to: ct.to,
        date: ct.date,
        departureTime: ct.departureTime,
        seats: ct.seats,
        validUntil,
        checkedIn: !!ct.checkedIn,
        checkedInAt: ct.checkedInAt,
        counter: true,
      })
    }

    await repairWronglyExpiredTickets(db, { bookingCode: params.code })
    const booking = await db.collection('bookings').findOne({ bookingCode: params.code })

    if (!booking) {
      await recordMiss(db, missKey)
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
