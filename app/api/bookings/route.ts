import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import {
  generateBookingCode,
  ticketExpiry,
  calculateHoldExpiry,
  calculateCommission,
  DEFAULT_COMMISSION_RATE,
  generateTicketQRCode,
  getVerifyUrl,
} from '@/lib/tickets'
import { releaseExpiredHolds, repairWronglyExpiredTickets } from '@/lib/seatHold'
import { takenSeats } from '@/lib/seats'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'
import { Booking } from '@/lib/models'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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
    await releaseExpiredHolds(db, busId)

    const bus = await db.collection('buses').findOne({ _id: new ObjectId(busId) })
    if (!bus || bus.status !== 'active') {
      return NextResponse.json({ error: 'Bus not available' }, { status: 404 })
    }

    const unavailable = takenSeats(bus as { bookedSeats?: string[]; blockedSeats?: string[] })
    const conflict = seats.find((s: string) => unavailable.includes(s))
    if (conflict) {
      return NextResponse.json({ error: `Seat ${conflict} is no longer available` }, { status: 409 })
    }

    // Atomically reserve the seats so two customers can't grab the same seat at once
    const reserveResult = await db.collection('buses').updateOne(
      { _id: new ObjectId(busId), bookedSeats: { $nin: seats }, blockedSeats: { $nin: seats } },
      { $push: { bookedSeats: { $each: seats } } } as any
    )
    if (reserveResult.modifiedCount === 0) {
      return NextResponse.json({ error: 'One or more seats were just taken by someone else' }, { status: 409 })
    }

    const bookingCode = generateBookingCode()
    const validUntil = ticketExpiry(bus.date)
    const holdExpiresAt = calculateHoldExpiry(10)
    const verifyUrl = getVerifyUrl(bookingCode)
    const qrCode = await generateTicketQRCode(verifyUrl)
    const totalPrice = seats.length * bus.price
    const commissionRate = bus.commissionRate ?? DEFAULT_COMMISSION_RATE
    const { commissionAmount, companyPayout } = calculateCommission(totalPrice, commissionRate)

    const booking: Booking = {
      bookingCode,
      busId,
      busName: bus.busName,
      companyName: bus.companyName,
      logoUrl: bus.logoUrl,
      from: bus.from,
      to: bus.to,
      date: bus.date,
      departureTime: bus.departureTime,
      seats,
      totalPrice,
      commissionRate,
      commissionAmount,
      companyPayout,
      passengerName,
      passengerPhone,
      passengerEmail,
      paymentStatus: 'pending',
      status: 'pending',
      qrCode,
      source: source === 'whatsapp' ? 'whatsapp' : 'web',
      createdAt: new Date().toISOString(),
      validUntil,
      holdExpiresAt,
      checkedIn: false,
    }

    const result = await db.collection('bookings').insertOne(booking as any)

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
    await repairWronglyExpiredTickets(db)
    let query: Record<string, any> = {}
    if (company) {
      const buses = await db.collection('buses').find({ companyId: company.companyId }).project({ _id: 1 }).toArray()
      const busIds = buses.map((b) => b._id.toString())
      query = { busId: { $in: busIds } }
    }
    const bookings = await db.collection('bookings').find(query).sort({ createdAt: -1 }).limit(200).toArray()
    return NextResponse.json({ bookings }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
