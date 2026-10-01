import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getPlaces } from '@/lib/places'
import { dhakaDate, startOfDhakaDay } from '@/lib/scan'
import { getCompanyUser } from '@/lib/staff'
import { createTrip } from '@/lib/tripCreate'
import { costsForTrips } from '@/lib/tripCosts'
import { tripDeparted } from '@/lib/trips'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
/** How far back the manager's trip list reaches. */
const HISTORY_DAYS = 30

/**
 * The company's trips with every seat accounted for: sold on BusHub, being bought on BusHub right
 * now (a 10-minute hold), or sold at the counter and by whom. The manager also gets the BusHub
 * passengers, payout and costs per trip, and trips from the last month; the counter only trips to come.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'manager' && user.role !== 'counter')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const manager = user.role === 'manager'
    const today = dhakaDate()
    const since = manager ? dhakaDate(new Date(startOfDhakaDay(today).getTime() - HISTORY_DAYS * 86400000)) : today

    const [fleet, found, places] = await Promise.all([
      db.collection('fleet').find({ companyId: user.companyId }).sort({ nameKey: 1 }).toArray(),
      db
        .collection('buses')
        .find({ companyId: user.companyId, status: 'active', date: { $gte: since } })
        .sort({ date: 1, departureTime: 1 })
        .toArray(),
      getPlaces(db),
    ])
    const trips = manager ? found : found.filter((t) => !tripDeparted(t.date, t.departureTime))
    const ids = trips.map((t) => t._id.toString())
    const [bookings, sales] = await Promise.all([
      db
        .collection('bookings')
        .find({ busId: { $in: ids }, status: { $in: ['pending', 'confirmed'] } })
        .project({ busId: 1, seats: 1, status: 1, paymentStatus: 1, passengerName: 1, bookingCode: 1, totalPrice: 1, companyPayout: 1, holdExpiresAt: 1, checkedIn: 1 })
        .toArray(),
      db.collection('counterSales').find({ busId: { $in: ids } }).toArray(),
    ])
    const costs = manager ? await costsForTrips(db, ids) : []
    const now = new Date().toISOString()

    return NextResponse.json(
      {
        me: { name: user.name, role: user.role, staffId: user.staffId || null },
        fleet: fleet.map((f) => ({ _id: f._id.toString(), name: f.name, busType: f.busType, totalSeats: f.totalSeats })),
        cities: places.cities,
        trips: trips.map((t) => {
          const id = t._id.toString()
          const mine = bookings.filter((b) => b.busId === id)
          const paid = mine.filter((b) => b.status === 'confirmed' && b.paymentStatus === 'paid')
          const held = mine.filter((b) => b.status === 'pending' && b.holdExpiresAt > now)
          const blocked: string[] = t.blockedSeats || []
          return {
            _id: id,
            fleetId: t.fleetId || null,
            busName: t.busName,
            busType: t.busType,
            from: t.from,
            to: t.to,
            date: t.date,
            departureTime: t.departureTime,
            arrivalTime: t.arrivalTime || '',
            boardingPoint: t.boardingPoint || '',
            price: t.price,
            totalSeats: t.totalSeats,
            departed: tripDeparted(t.date, t.departureTime),
            onlineSeats: paid.flatMap((b) => b.seats || []),
            heldSeats: held.flatMap((b) => b.seats || []),
            counterSeats: blocked.map((seat) => {
              const sale = sales.find((s) => s.busId === id && s.seat === seat)
              return { seat, soldBy: sale?.soldBy || 'BusHub admin', staffId: sale?.staffId || null, soldAt: sale?.soldAt || null }
            }),
            ...(manager
              ? {
                  onlineTickets: paid.map((b) => ({
                    code: b.bookingCode,
                    passengerName: b.passengerName,
                    seats: b.seats || [],
                    total: b.totalPrice || 0,
                    payout: b.companyPayout || 0,
                    boarded: Boolean(b.checkedIn),
                  })),
                  costs: costs.filter((c) => c.busId === id),
                }
              : {}),
          }
        }),
      },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load trips' }, { status: 500 })
  }
}

/** The manager or a counter adds a trip for one of the company's own buses. */
export async function POST(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'manager' && user.role !== 'counter')) {
      return NextResponse.json({ error: 'Only the manager or a counter can add trips' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const result = await createTrip(db, body, user.companyId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add the trip' }, { status: 500 })
  }
}
