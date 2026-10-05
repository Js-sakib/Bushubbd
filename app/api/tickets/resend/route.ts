import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { emailTickets, whatsappTickets, type DeliverableTicket } from '@/lib/ticketDelivery'
import { emailPattern, looksLikeEmail, mobileCore, phonePattern, ticketCode } from '@/lib/ticketLookup'
import { ticketExpiry } from '@/lib/tickets'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** Requests allowed per visitor, and per number or email, in each ten-minute window. */
const PER_VISITOR = 10
const PER_CONTACT = 3
/** At most this many tickets go out in one message. */
const MAX_TICKETS = 5

const INTRO = 'Here are your BusHub tickets, as you asked. Open a ticket to see its QR code and download it.'

/**
 * "Send my tickets again". The passenger types the mobile number, email or ticket number they
 * booked with, and their paid tickets go to that number's WhatsApp or that email. Nothing about
 * the tickets is shown or said here, and the reply is the same whether or not any were found, so
 * someone who knows a passenger's number learns nothing and can't open their ticket.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const contact = String(body?.contact || '').trim()
    const email = looksLikeEmail(contact)
    const code = email ? null : ticketCode(contact)
    const core = email || code ? null : mobileCore(contact)
    if (!email && !code && !core) {
      return NextResponse.json({ error: 'Please write a mobile number like 01712345678, an email or a ticket number' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const visitorKey = `resend-ip|${clientIp(req.headers)}`
    const contactKey = `resend-contact|${core ?? code ?? contact.toLowerCase()}`
    if ((await tooManyMisses(db, visitorKey, PER_VISITOR)) || (await tooManyMisses(db, contactKey, PER_CONTACT))) {
      return NextResponse.json({ error: 'Too many requests. Please wait 10 minutes and try again.' }, { status: 429 })
    }
    await Promise.all([recordMiss(db, visitorKey), recordMiss(db, contactKey)])

    const match = code ? { bookingCode: code } : core ? { passengerPhone: phonePattern(core) } : { passengerEmail: emailPattern(contact) }
    const found = (await db
      .collection('bookings')
      .find({ ...match, paymentStatus: 'paid', status: { $nin: ['refunded', 'cancelled'] } })
      .sort({ date: 1, departureTime: 1 })
      .limit(100)
      .toArray()) as unknown as DeliverableTicket[]

    // Trips still ahead first; if none, the most recent ones.
    const now = Date.now()
    const ahead = found.filter((t) => new Date(ticketExpiry(t.date)).getTime() >= now)
    const tickets = (ahead.length ? ahead : found.reverse()).slice(0, MAX_TICKETS)

    const via = email ? 'email' : code ? 'both' : 'whatsapp'
    if (tickets.length) {
      if (email) {
        await emailTickets(contact.trim(), tickets, INTRO)
      } else if (core) {
        await whatsappTickets(tickets[0].passengerPhone || `0${core}`, tickets, INTRO)
      } else {
        // A ticket number: the ticket goes to the number and email it was booked with, never elsewhere.
        const t = tickets[0]
        await Promise.all([
          t.passengerPhone ? whatsappTickets(t.passengerPhone, [t], INTRO) : Promise.resolve(false),
          t.passengerEmail ? emailTickets(t.passengerEmail, [t], INTRO) : Promise.resolve(false),
        ])
      }
    }

    return NextResponse.json({
      success: true,
      via,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not send right now, please try again' }, { status: 500 })
  }
}
