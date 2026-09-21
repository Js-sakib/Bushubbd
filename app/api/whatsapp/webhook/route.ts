import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://bushubbd.vercel.app'
}

function findCityInText(text: string): string | undefined {
  const lower = text.toLowerCase()
  return CITIES.find((city) => lower.includes(city.toLowerCase()))
}

function parseRoute(text: string): { from?: string; to?: string } {
  const lower = text.toLowerCase()
  const separators = [' to ', '-', '>', ' theke ', ' theke']
  for (const sep of separators) {
    if (lower.includes(sep)) {
      const [rawFrom, rawTo] = lower.split(sep)
      const from = findCityInText(rawFrom)
      const to = findCityInText(rawTo)
      if (from && to) return { from, to }
    }
  }
  const found = CITIES.filter((city) => lower.includes(city.toLowerCase()))
  if (found.length >= 2) return { from: found[0], to: found[1] }
  return {}
}

function today() {
  return new Date().toISOString().split('T')[0]
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
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const message = change?.value?.messages?.[0]

    if (!message || message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const from = message.from as string
    const text = (message.text?.body || '').trim()
    const lowerText = text.toLowerCase()

    const { db } = await connectToDatabase()
    const sessions = db.collection('sessions')
    const session = (await sessions.findOne({ phone: from })) || { phone: from, step: 'idle' }

    if (['hi', 'hello', 'hey', 'start', 'menu'].includes(lowerText)) {
      await sendWhatsAppMessage(
        from,
        `👋 Welcome to BusHub!\n\nTo find a bus, tell me your route, e.g.:\n"Dhaka to Sylhet"\n\nAvailable cities: ${CITIES.join(', ')}`
      )
      await sessions.updateOne(
        { phone: from },
        { $set: { phone: from, step: 'awaiting_route', updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return NextResponse.json({ status: 'ok' })
    }

    const { from: fromCity, to: toCity } = parseRoute(text)

    if (fromCity && toCity) {
      const date = today()
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
        await sendWhatsAppMessage(
          from,
          `No buses found right now from ${fromCity} to ${toCity}.\n\nCheck the latest availability here:\n${searchLink}`
        )
      } else {
        const list = buses
          .map(
            (b) =>
              `🚌 ${b.busName} (${b.busType})\n⏰ ${b.departureTime} | ৳${b.price}\n🪑 ${b.totalSeats - (b.bookedSeats?.length || 0)} seats left`
          )
          .join('\n\n')

        await sendWhatsAppMessage(
          from,
          `Buses from ${fromCity} to ${toCity} today:\n\n${list}\n\n👉 Book & pay here (link valid now):\n${searchLink}\n\nYour ticket will be generated instantly after payment, valid for 24 hours.`
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
      `Sorry, I didn't understand that. Please tell me your route like:\n"Dhaka to Sylhet"\n\nAvailable cities: ${CITIES.join(', ')}`
    )
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}
