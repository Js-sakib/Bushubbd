import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { dhakaDate, startOfDhakaDay } from '@/lib/scan'
import { costsForTrips } from '@/lib/tripCosts'
import { tripMoney } from '@/lib/tripMoney'
import { tripDeparted } from '@/lib/trips'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const HISTORY_DAYS = 30

/**
 * Every company's trips from the last 30 days and to come, with the money of each: BusHub
 * tickets, BusHub's commission, the payout, counter sales and the costs the bus staff entered.
 */
export async function GET() {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { db } = await connectToDatabase()
    const since = dhakaDate(new Date(startOfDhakaDay(dhakaDate()).getTime() - HISTORY_DAYS * 86400000))
    const trips = await db
      .collection('buses')
      .find({ status: 'active', date: { $gte: since } })
      .sort({ date: 1, departureTime: 1 })
      .toArray()
    const ids = trips.map((t) => t._id.toString())
    const companyIds = Array.from(new Set(trips.map((t) => String(t.companyId || '')).filter((id) => ObjectId.isValid(id))))
    const [bookings, costs, companies] = await Promise.all([
      db
        .collection('bookings')
        .find({ busId: { $in: ids }, status: 'confirmed', paymentStatus: 'paid' })
        .project({ busId: 1, seats: 1, totalPrice: 1, companyPayout: 1 })
        .toArray(),
      costsForTrips(db, ids),
      db
        .collection('companies')
        .find({ _id: { $in: companyIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1 })
        .toArray(),
    ])
    const companyName = new Map(companies.map((c) => [c._id.toString(), String(c.name)]))
    const group = <T extends { busId: string }>(rows: T[]) => {
      const map = new Map<string, T[]>()
      for (const r of rows) map.set(r.busId, [...(map.get(r.busId) || []), r])
      return map
    }
    const bookingsByTrip = group(bookings as unknown as { busId: string; seats?: string[]; totalPrice?: number; companyPayout?: number }[])
    const costsByTrip = group(costs)

    return NextResponse.json(
      {
        companies: companies.map((c) => ({ _id: c._id.toString(), name: String(c.name) })).sort((a, b) => a.name.localeCompare(b.name)),
        trips: trips.map((t) => {
          const id = t._id.toString()
          const tripCosts = costsByTrip.get(id) || []
          return {
            _id: id,
            companyId: String(t.companyId || ''),
            companyName: companyName.get(String(t.companyId || '')) || t.companyName || 'No company',
            busName: t.busName,
            from: t.from,
            to: t.to,
            date: t.date,
            departureTime: t.departureTime,
            departed: tripDeparted(t.date, t.departureTime),
            money: tripMoney({
              price: t.price,
              totalSeats: t.totalSeats,
              counterSeats: (t.blockedSeats || []).length,
              online: (bookingsByTrip.get(id) || []).map((b) => ({ seats: (b.seats || []).length, total: b.totalPrice || 0, payout: b.companyPayout || 0 })),
              costs: tripCosts,
            }),
            costs: tripCosts,
          }
        }),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load trip money' }, { status: 500 })
  }
}
