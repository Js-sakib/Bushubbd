import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { emailPattern, looksLikeEmail, mobileCore, nameMatches, phonePattern } from '@/lib/ticketLookup'
import { ticketExpiry } from '@/lib/tickets'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** Wrong tries allowed per visitor, and per number or email, in each ten-minute window. */
const MISSES_PER_VISITOR = 10
const MISSES_PER_CONTACT = 5

const NOT_FOUND = 'No tickets found. Check the number or email and the name you booked with.'

/**
 * A passenger finds their tickets again with the mobile number or email they booked with and
 * their name. Both have to match a paid ticket. Wrong tries are counted per visitor and per
 * number, so the name can't be guessed by trying again and again.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const contact = String(body?.contact || '').trim()
    const name = String(body?.name || '').trim()
    if (!contact || !name) {
      return NextResponse.json({ error: 'Please write your mobile number or email, and your name' }, { status: 400 })
    }

    const core = looksLikeEmail(contact) ? null : mobileCore(contact)
    if (!core && !looksLikeEmail(contact)) {
      return NextResponse.json({ error: 'Please write a mobile number like 01712345678, or an email' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const visitorKey = `lookup-ip|${clientIp(req.headers)}`
    const contactKey = `lookup-contact|${core ?? contact.toLowerCase()}`
    if ((await tooManyMisses(db, visitorKey, MISSES_PER_VISITOR)) || (await tooManyMisses(db, contactKey, MISSES_PER_CONTACT))) {
      return NextResponse.json({ error: 'Too many tries. Please wait 10 minutes and try again.' }, { status: 429 })
    }

    const match = core ? { passengerPhone: phonePattern(core) } : { passengerEmail: emailPattern(contact) }
    const candidates = await db
      .collection('bookings')
      .find({ ...match, paymentStatus: 'paid' })
      .project({
        bookingCode: 1,
        passengerName: 1,
        from: 1,
        to: 1,
        date: 1,
        departureTime: 1,
        seats: 1,
        companyName: 1,
        busName: 1,
        status: 1,
        totalPrice: 1,
        checkedIn: 1,
      })
      .sort({ date: -1, departureTime: -1 })
      .limit(200)
      .toArray()

    const tickets = candidates
      .filter((b) => nameMatches(name, String(b.passengerName || '')))
      .slice(0, 50)
      .map((b) => ({
        bookingCode: b.bookingCode,
        from: b.from,
        to: b.to,
        date: b.date,
        departureTime: b.departureTime,
        seats: b.seats || [],
        companyName: b.companyName,
        busName: b.busName,
        totalPrice: b.totalPrice,
        status: b.status === 'refunded' ? 'refunded' : b.checkedIn ? 'boarded' : new Date(ticketExpiry(b.date)).getTime() < Date.now() ? 'past' : 'upcoming',
      }))

    if (tickets.length === 0) {
      await Promise.all([recordMiss(db, visitorKey), recordMiss(db, contactKey)])
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }
    return NextResponse.json({ tickets })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not search right now, please try again' }, { status: 500 })
  }
}
