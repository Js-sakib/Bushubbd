import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { platesByFleet } from '@/lib/plates'
import { costRow, costTrip, costsForTrips, staffCostWindow } from '@/lib/tripCosts'
import { COST_TYPES, MAX_COST_AMOUNT, MAX_COSTS_PER_TRIP, type CostType } from '@/lib/tripMoney'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

/**
 * Trip costs (fuel, road, toll, other). The bus staff (scanner logins) enter them for yesterday's,
 * today's and tomorrow's trips; the manager for any trip of the company. Counter logins don't.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'scanner' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const window = staffCostWindow()
    const trips = await db
      .collection('buses')
      .find({ companyId: user.companyId, status: 'active', date: { $gte: window.from, $lte: window.to } })
      .sort({ date: 1, departureTime: 1 })
      .toArray()
    const [costs, plates] = await Promise.all([costsForTrips(db, trips.map((t) => t._id.toString())), platesByFleet(db, trips.map((t) => t.fleetId))])
    return NextResponse.json(
      { me: { name: user.name, role: user.role, staffId: user.staffId || null }, trips: trips.map((t) => costTrip(t, t.fleetId ? plates.get(String(t.fleetId)) : '')), costs },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load costs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'scanner' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Only the bus staff (scanner) and manager logins can add costs' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const type = String(body.type || '') as CostType
    const amount = Number(body.amount)
    const note = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (!COST_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Choose fuel, road, toll or other' }, { status: 400 })
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_COST_AMOUNT) {
      return NextResponse.json({ error: `Type the amount in taka, from 1 to ${MAX_COST_AMOUNT.toLocaleString('en-US')}` }, { status: 400 })
    }
    if (!ObjectId.isValid(String(body.tripId || ''))) {
      return NextResponse.json({ error: 'Choose a trip' }, { status: 400 })
    }
    const trip = await db.collection('buses').findOne({ _id: new ObjectId(String(body.tripId)), companyId: user.companyId, status: 'active' })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (user.role === 'scanner') {
      const window = staffCostWindow()
      if (trip.date < window.from || trip.date > window.to) {
        return NextResponse.json({ error: 'Bus staff can add costs for yesterday, today and tomorrow only. Ask your manager.' }, { status: 403 })
      }
    }
    const tripId = trip._id.toString()
    if ((await db.collection('tripCosts').countDocuments({ busId: tripId })) >= MAX_COSTS_PER_TRIP) {
      return NextResponse.json({ error: 'This trip has too many cost entries. Ask your manager.' }, { status: 409 })
    }
    const doc = {
      busId: tripId,
      companyId: user.companyId,
      fleetId: trip.fleetId || null,
      type,
      amount,
      note,
      addedBy: user.name,
      staffId: user.staffId || null,
      role: user.role,
      createdAt: new Date().toISOString(),
    }
    const result = await db.collection('tripCosts').insertOne(doc)
    return NextResponse.json({ cost: costRow({ ...doc, _id: result.insertedId }) }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add the cost' }, { status: 500 })
  }
}
