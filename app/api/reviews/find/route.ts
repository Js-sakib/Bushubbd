import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { mobileCore, phonePattern, ticketCode } from '@/lib/ticketLookup'

export const dynamic = 'force-dynamic'

/** Wrong ticket-and-phone tries one connection may make in ten minutes. */
const FIND_MISS_LIMIT = 10
/** The same answer for every wrong try, so it never tells which part was wrong. */
const NO_MATCH = "Ticket number and phone don't match a paid ticket"

/**
 * "Write a review" from the home page: the passenger types their ticket number and the phone it
 * was booked with. When both match a paid ticket, the reply is just enough to show the review
 * form (the ticket number, route, date and bus company); never the passenger's name or phone.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const { db } = await connectToDatabase()
    const missKey = `review-find:${clientIp(req.headers)}`
    if (await tooManyMisses(db, missKey, FIND_MISS_LIMIT)) {
      return NextResponse.json({ error: 'Too many tries. Please wait 10 minutes and try again.' }, { status: 429 })
    }
    const code = ticketCode(String(body?.ticket || ''))
    const core = mobileCore(String(body?.phone || ''))
    const booking =
      code && core ? await db.collection('bookings').findOne({ bookingCode: code, passengerPhone: { $regex: phonePattern(core) } }) : null
    if (!booking || booking.paymentStatus !== 'paid' || booking.status === 'refunded' || booking.status === 'cancelled') {
      await recordMiss(db, missKey)
      return NextResponse.json({ error: NO_MATCH }, { status: 404 })
    }
    return NextResponse.json({
      bookingCode: booking.bookingCode,
      companyName: String(booking.companyName || ''),
      from: String(booking.from || ''),
      to: String(booking.to || ''),
      travelDate: String(booking.date || ''),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not check your ticket, please try again' }, { status: 500 })
  }
}
