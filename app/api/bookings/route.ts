import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { generateBookingCode, calculateExpiry, generateTicketQRCode } from '@/lib/tickets'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'
import { Booking } from '@/lib/models'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { busId, seats, passengerName, passengerPhone, passengerEmail, source } = body

    if (!busId || !Array.isArray(seats) || seats.length === 0 || !passengerName || !passengerPhone) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 })
    }
    if (!ObjectId.isValid(busId)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(busId) })
    if (!bus || bus.status !== 'active') {
      return NextResponse.json({ error: 'Bus not available' }, { status: 404 })
    }

    const alreadyBooked = (bus.bookedSeats || []) as string[]
    const conflict = seats.find((s: string) => alreadyBooked.includes(s))
    if (conflict) {
      return NextResponse.json({ error: `Seat ${conflict} is already booked` }, { status: 409 })
    }

    const bookingCode = generateBookingCode()
    const validUntil = calculateExpiry(24)
    const qrCode = await generateTicketQRCode(bookingCode)
    const totalPrice = seats.length * bus.price

    const booking: Booking = {
      bookingCode,
      busId,
      busName: bus.busName,
      companyName: bus.companyName,
      from: bus.from,
      to: bus.to,
      date: bus.date,
      departureTime: bus.departureTime,
      seats,
      totalPrice,
      passengerName,
      passengerPhone,
      passengerEmail,
      paymentStatus: 'pending',
      status: 'confirmed',
      qrCode,
      source: source === 'whatsapp' ? 'whatsapp' : 'web',
      createdAt: new Date().toISOString(),
      validUntil,
    }

    const result = await db.collection('bookings').insertOne(booking as any)
    await db.collection('buses').updateOne(
      { _id: new ObjectId(busId) },
      { $push: { bookedSeats: { $each: seats } } } as any
    )

    sendWhatsAppMessage(
      passengerPhone,
      `Your BusHub ticket is confirmed!\nBooking: ${bookingCode}\n${bus.from} to ${bus.to}\nDate: ${bus.date} ${bus.departureTime}\nSeats: ${seats.join(', ')}\nTotal: ৳${totalPrice}\nValid for 24 hours.`
    ).catch(() => {})

    return NextResponse.json({ booking: { ...booking, _id: result.insertedId } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const company = getCompanyFromCookies()
    const admin = getAdminFromCookies()
    if (!company && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    let query: Record<string, any> = {}
    if (company) {
      const buses = await db.collection('buses').find({ companyId: company.companyId }).project({ _id: 1 }).toArray()
      const busIds = buses.map((b) => b._id.toString())
      query = { busId: { $in: busIds } }
    }
    const bookings = await db.collection('bookings').find(query).sort({ createdAt: -1 }).limit(200).toArray()
    return NextResponse.json({ bookings })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
