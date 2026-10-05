import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { contactQuery, latinDigits, mobileCore, ticketCode } from '@/lib/ticketLookup'

export const dynamic = 'force-dynamic'

/** Requests allowed per visitor, and per number or email, in each ten-minute window. */
const PER_VISITOR = 5
const PER_CONTACT = 2

/**
 * A passenger who lost their ticket asks the BusHub team for it. The request lands on the admin
 * dashboard, where the admin checks it against the bookings and sends the ticket to the number
 * or email it was booked with. The reply never says whether any ticket was found.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const contact = latinDigits(String(body?.contact || '').trim()).slice(0, 120)
    const name = String(body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    const note = String(body?.note || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    if (!contactQuery(contact)) {
      return NextResponse.json({ error: 'Please write a mobile number like 01712345678, an email or a ticket number' }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Please write your name as on the ticket' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const visitorKey = `ticketreq-ip|${clientIp(req.headers)}`
    // One key per number however it is typed (01…, +880 1…, Bangla digits), so the limit can't be dodged.
    const contactKey = `ticketreq-contact|${mobileCore(contact) ?? ticketCode(contact) ?? contact.toLowerCase()}`
    if ((await tooManyMisses(db, visitorKey, PER_VISITOR)) || (await tooManyMisses(db, contactKey, PER_CONTACT))) {
      return NextResponse.json({ error: 'We already have your request. Our team will contact you soon.' }, { status: 429 })
    }
    await Promise.all([recordMiss(db, visitorKey), recordMiss(db, contactKey)])

    await db.collection('ticketRequests').insertOne({ contact, name, note, status: 'new', createdAt: new Date().toISOString() })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not send your request, please try again' }, { status: 500 })
  }
}
