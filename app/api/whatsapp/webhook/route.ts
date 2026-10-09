import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { isExpired, getVerifyUrl, ticketExpiry } from '@/lib/tickets'
import { seatsLeft as calcSeatsLeft } from '@/lib/seats'
import { getPlaces } from '@/lib/places'
import { tripDeparted } from '@/lib/trips'
import { SITE_URL } from '@/lib/site'
import { createHmac, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const GREETINGS = ['hi', 'hello', 'hey', 'start', 'menu', 'help', 'salam', 'assalamu alaikum', 'হাই', 'হ্যালো', 'সালাম', 'আসসালামু আলাইকুম']

const BOOKING_CODE = /\bBH-\d{8}-[A-Z0-9]{5}\b/i

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || SITE_URL
}

function findCityInText(text: string, cities: string[]): string | undefined {
  const lower = text.toLowerCase()
  return cities.find((city) => lower.includes(city.toLowerCase()))
}

function parseRoute(text: string, cities: string[]): { from?: string; to?: string } {
  const lower = text.toLowerCase()
  const separators = [' to ', ' theke ', '->', '>', '-']
  for (const sep of separators) {
    if (lower.includes(sep)) {
      const [rawFrom, rawTo] = lower.split(sep)
      const from = findCityInText(rawFrom, cities)
      const to = findCityInText(rawTo, cities)
      if (from && to && from !== to) return { from, to }
    }
  }
  const found = cities.filter((city) => lower.includes(city.toLowerCase()))
  if (found.length >= 2) return { from: found[0], to: found[1] }
  return {}
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
}

// Word boundaries matter: "aj" is a substring of "Rajshahi".
function parseDate(text: string): { date: string; label: string } {
  const lower = text.toLowerCase()
  if (/\b(tomorrow|kal|kaal)\b/.test(lower) || lower.includes('আগামীকাল')) {
    return { date: addDays(1), label: 'tomorrow' }
  }
  return { date: addDays(0), label: 'today' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * True when the message really comes from Meta: it signs each delivery with the app secret
 * (X-Hub-Signature-256). Until WHATSAPP_APP_SECRET is set the bot keeps working unchecked, with
 * a warning in the logs, so adding the check never takes the live bot down.
 */
function fromMeta(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    console.warn('WhatsApp webhook: WHATSAPP_APP_SECRET is not set, so messages are not checked')
    return true
  }
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`)
  const given = Buffer.from(header || '')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    if (!fromMeta(raw, req.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
    }
    const body = JSON.parse(raw)
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

    if (!message || message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const from = message.from as string
    const text = (message.text?.body || '').trim()
    const lowerText = text.toLowerCase()

    const { db } = await connectToDatabase()
    const CITIES = (await getPlaces(db)).cities
    const sessions = db.collection('sessions')

    if (GREETINGS.includes(lowerText)) {
      await sendWhatsAppMessage(
        from,
        `Welcome to BusHub!\n\nTell me your route and I will find your bus, for example:\n"Dhaka to Sylhet"\n"Dhaka to Chittagong tomorrow"\n\nYou can also send your booking code (BH-...) to check a ticket.\n\nCities: ${CITIES.join(', ')}`
      )
      await sessions.updateOne(
        { phone: from },
        { $set: { phone: from, step: 'awaiting_route', updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return NextResponse.json({ status: 'ok' })
    }

    const codeMatch = text.match(BOOKING_CODE)
    if (codeMatch) {
      const bookingCode = codeMatch[0].toUpperCase()
      const booking = await db.collection('bookings').findOne({ bookingCode })

      if (!booking) {
        await sendWhatsAppMessage(from, `No ticket found with the code ${bookingCode}. Please check the code and try again.`)
      } else {
        const expired = isExpired(ticketExpiry(booking.date))
        const state =
          booking.status === 'refunded'
            ? 'This ticket was refunded and can no longer be used.'
            : booking.paymentStatus !== 'paid'
            ? 'Payment for this ticket was never completed.'
            : expired
            ? 'This ticket has expired.'
            : 'This ticket is valid.'

        await sendWhatsAppMessage(
          from,
          `Ticket ${booking.bookingCode}\n${state}\n\n${booking.from} to ${booking.to}\nDate: ${booking.date} ${booking.departureTime}\nSeats: ${booking.seats.join(', ')}\nTotal: ৳${booking.totalPrice}\n\nShow this to the conductor:\n${getVerifyUrl(booking.bookingCode)}`
        )
      }
      return NextResponse.json({ status: 'ok' })
    }

    const { from: fromCity, to: toCity } = parseRoute(text, CITIES)

    if (fromCity && toCity) {
      const { date, label } = parseDate(text)
      // Buses that have already left today are not offered.
      const buses = (
        await db
          .collection('buses')
          .find({ from: fromCity, to: toCity, date, status: 'active' })
          .sort({ departureTime: 1 })
          .toArray()
      )
        .filter((b) => !tripDeparted(b.date, b.departureTime))
        .slice(0, 5)

      const searchLink = `${getBaseUrl()}/search?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(
        toCity
      )}&date=${date}`

      if (buses.length === 0) {
        // Nothing on the day they asked for, so point them at the next day that does have buses.
        const next = await db
          .collection('buses')
          .find({ from: fromCity, to: toCity, status: 'active', date: { $gt: date } })
          .sort({ date: 1 })
          .limit(1)
          .toArray()

        if (next.length > 0) {
          const nextDate = next[0].date
          const nextLink = `${getBaseUrl()}/search?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(
            toCity
          )}&date=${nextDate}`
          await sendWhatsAppMessage(
            from,
            `No buses from ${fromCity} to ${toCity} ${label}.\n\nThe next available day is ${nextDate}:\n${nextLink}`
          )
        } else {
          await sendWhatsAppMessage(
            from,
            `No buses from ${fromCity} to ${toCity} ${label}.\n\nCheck the latest availability here:\n${searchLink}`
          )
        }
      } else {
        const list = buses
          .map((b) => {
            const seatsLeft = calcSeatsLeft(b as unknown as { totalSeats: number; bookedSeats?: string[]; blockedSeats?: string[] })
            return `${b.busName} (${b.busType})\n${b.departureTime} · ৳${b.price} · ${seatsLeft} seats left`
          })
          .join('\n\n')

        await sendWhatsAppMessage(
          from,
          `Buses from ${fromCity} to ${toCity} ${label}:\n\n${list}\n\nBook and pay here:\n${searchLink}\n\nYour QR ticket is generated the moment you pay, and is valid for your travel date.`
        )
      }

      await sessions.updateOne(
        { phone: from },
        { $set: { phone: from, step: 'idle', from: fromCity, to: toCity, updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return NextResponse.json({ status: 'ok' })
    }

    await sendWhatsAppMessage(
      from,
      `Sorry, I did not understand that.\n\nTell me your route like this:\n"Dhaka to Sylhet"\n"Dhaka to Chittagong tomorrow"\n\nOr send your booking code (BH-...) to check a ticket.\n\nCities: ${CITIES.join(', ')}`
    )
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    // Always 200: Meta retries aggressively on any non-200, which would spam the customer.
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}
