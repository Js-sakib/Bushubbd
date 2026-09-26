import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { Bus } from '@/lib/models'
import { DEFAULT_COMMISSION_RATE } from '@/lib/tickets'
import { getPlaces } from '@/lib/places'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')
    const companyId = searchParams.get('companyId')

    const query: Record<string, any> = { status: 'active' }
    if (from) query.from = from
    if (to) query.to = to
    if (date) query.date = date
    if (companyId) query.companyId = companyId

    const buses = await db.collection('buses').find(query).sort({ departureTime: 1 }).toArray()
    return NextResponse.json({ buses }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Adds a trip. The bus is picked from the admin's bus list; its name, company, type, seats and
 * logo are copied from there, never typed, so every ticket names the company that scans it.
 */
export async function POST(req: NextRequest) {
  try {
    // Operators send their schedules to the BusHub team; only the admin lists trips.
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can add buses' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { fleetId, from, to, date, departureTime } = body
    const arrivalTime = body.arrivalTime ? String(body.arrivalTime) : ''
    const price = Number(body.price)
    const commissionRate = body.commissionRate === undefined || body.commissionRate === '' ? DEFAULT_COMMISSION_RATE : Number(body.commissionRate)

    if (typeof fleetId !== 'string' || !ObjectId.isValid(fleetId)) {
      return NextResponse.json({ error: 'Choose the bus from your bus list' }, { status: 400 })
    }
    if (!from || !to || from === to) {
      return NextResponse.json({ error: 'Choose two different cities' }, { status: 400 })
    }
    if (!DATE.test(String(date)) || !TIME.test(String(departureTime)) || (arrivalTime && !TIME.test(arrivalTime))) {
      return NextResponse.json({ error: 'Check the date and times' }, { status: 400 })
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Enter the fare' }, { status: 400 })
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 50) {
      return NextResponse.json({ error: 'Commission must be between 0 and 50%' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const { cities } = await getPlaces(db)
    if (!cities.includes(from) || !cities.includes(to)) {
      return NextResponse.json({ error: 'Choose both cities from your city list' }, { status: 400 })
    }
    const fleetBus = await db.collection('fleet').findOne({ _id: new ObjectId(fleetId) })
    if (!fleetBus) {
      return NextResponse.json({ error: 'That bus is not on your bus list' }, { status: 400 })
    }
    const company = ObjectId.isValid(fleetBus.companyId)
      ? await db.collection('companies').findOne({ _id: new ObjectId(fleetBus.companyId) })
      : null
    if (!company || company.status !== 'approved') {
      return NextResponse.json({ error: `${fleetBus.companyName} is not an approved company right now` }, { status: 400 })
    }

    // One bus can't leave twice at the same moment.
    const clash = await db
      .collection('buses')
      .findOne({ fleetId, date, departureTime, status: 'active' }, { projection: { from: 1, to: 1 } })
    if (clash) {
      return NextResponse.json(
        { error: `${fleetBus.name} already has a trip on ${date} at ${departureTime} (${clash.from} → ${clash.to})` },
        { status: 409 }
      )
    }

    const bus: Bus = {
      fleetId,
      companyId: company._id.toString(),
      companyName: company.name,
      busName: fleetBus.name,
      busType: fleetBus.busType,
      logoUrl: fleetBus.logoUrl,
      from,
      to,
      date,
      departureTime,
      arrivalTime,
      price,
      totalSeats: fleetBus.totalSeats,
      bookedSeats: [],
      blockedSeats: [],
      commissionRate,
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    try {
      const result = await db.collection('buses').insertOne({ ...bus } as any)
      return NextResponse.json({ bus: { ...bus, _id: result.insertedId } }, { status: 201 })
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      return NextResponse.json({ error: `${fleetBus.name} already has a trip on ${date} at ${departureTime}` }, { status: 409 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create bus' }, { status: 500 })
  }
}
