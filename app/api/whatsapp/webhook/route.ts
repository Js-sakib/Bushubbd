import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { isExpired, getVerifyUrl } from '@/lib/tickets'
import { seatsLeft as calcSeatsLeft } from '@/lib/seats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']

const GREETINGS = ['hi', 'hello', 'hey', 'start', 'menu', 'help', 'salam', 'assalamu alaikum', 'হাই', 'হ্যালো', 'সালাম', 'আসসালামু আলাইকুম']

const BOOKING_CODE = /\bBH-\d{8}-[A-Z0-9]{5}\b/i

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://bushubbd.vercel.app'
}

function findCityInText(text: string): string | undefined {
  const lower = text.toLowerCase()
  return CITIES.find((city) => lower.includes(city.toLowerCase()))
}

function parseRoute(text: string): { from?: string; to?: string } {
  const lower = text.toLowerCase()
  const separators = [' to ', ' theke ', '->', '>', '-']
  for (const sep of separators) {
    if (lower.includes(sep)) {
      const [rawFrom, rawTo] = lower.split(sep)
      const from = findCityInText(rawFrom)
      const to = findCityInText(rawTo)
      if (from && to && from !== to) return { from, to }
    }
  }
  const found = CITIES.filter((city) => lower.includes(city.toLowerCase()))
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

    if (!message || message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const from = message.from as string
    const text = (message.text?.body || '').trim()
    const lowerText = text.toLowerCase()

    const { db } = await connectToDatabase()
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
        const expired = isExpired(booking.validUntil)
        const state =
          booking.status === 'refunded'
            ? 'This ticket was refunded and can no longer be used.'
            : booking.paymentStatus !== 'paid'
            ? 'Payment for this ticket was never completed.'
            : expired || booking.status === 'expired'
            ? 'This ticket has expired.'
            : 'This ticket is valid.'

        await sendWhatsAppMessage(
          from,
          `Ticket ${booking.bookingCode}\n${state}\n\n${booking.from} to ${booking.to}\nDate: ${booking.date} ${booking.departureTime}\nSeats: ${booking.seats.join(', ')}\nTotal: ৳${booking.totalPrice}\n\nShow this to the conductor:\n${getVerifyUrl(booking.bookingCode)}`
        )
      }
      return NextResponse.json({ status: 'ok' })
    }

    const { from: fromCity, to: toCity } = parseRoute(text)

    if (fromCity && toCity) {
      const { date, label } = parseDate(text)
      const buses = await db
        .collection('buses')
        .find({ from: fromCity, to: toCity, date, status: 'active' })
        .sort({ departureTime: 1 })
        .limit(5)
        .toArray()

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
          `Buses from ${fromCity} to ${toCity} ${label}:\n\n${list}\n\nBook and pay here:\n${searchLink}\n\nYour QR ticket is generated the moment you pay, and stays valid for 24 hours.`
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
