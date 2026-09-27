import type { Db } from 'mongodb'
import { connectToDatabase } from './db'
import { DEFAULT_PLACES, getPlaces, type Places, type PopularRoute } from './places'
import { dhakaDate } from './scan'

/** One upcoming trip as a public route page shows it: no seat lists, no commission. */
export interface RouteTrip {
  id: string
  busName: string
  companyName: string
  busType: string
  date: string
  departureTime: string
  arrivalTime: string
  price: number
  seatsLeft: number
}

export interface RouteSummary extends PopularRoute {
  trips: number
  minPrice: number
}

/**
 * The database and the admin's places for the public pages. A page for search engines must
 * still render if the database is slow or down, so this falls back to the default city list.
 */
export async function loadPublicPlaces(): Promise<{ db: Db | null; places: Places }> {
  try {
    const { db } = await connectToDatabase()
    return { db, places: await getPlaces(db) }
  } catch (err) {
    console.error('Public pages: database unavailable', err)
    return { db: null, places: DEFAULT_PLACES }
  }
}

function dhakaClock(at: Date = new Date()): string {
  return new Date(at.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

/** Trips on this route that have not left yet, soonest first. */
export async function upcomingTrips(db: Db, from: string, to: string, limit = 12): Promise<RouteTrip[]> {
  const today = dhakaDate()
  const now = dhakaClock()
  const buses = await db
    .collection('buses')
    .find({ from, to, status: 'active', date: { $gte: today } })
    .sort({ date: 1, departureTime: 1 })
    .limit(limit + 20)
    .toArray()

  return buses
    .filter((bus) => bus.date > today || String(bus.departureTime) > now)
    .slice(0, limit)
    .map((bus) => {
      const taken = new Set<string>([...(bus.bookedSeats || []), ...(bus.blockedSeats || [])])
      return {
        id: String(bus._id),
        busName: String(bus.busName || ''),
        companyName: String(bus.companyName || ''),
        busType: String(bus.busType || ''),
        date: String(bus.date),
        departureTime: String(bus.departureTime || ''),
        arrivalTime: String(bus.arrivalTime || ''),
        price: Number(bus.price) || 0,
        seatsLeft: Math.max(0, (Number(bus.totalSeats) || 0) - taken.size),
      }
    })
}

/** Every route with at least one trip from today on, with its cheapest fare. */
export async function routesWithTrips(db: Db): Promise<RouteSummary[]> {
  const rows = await db
    .collection('buses')
    .aggregate([
      { $match: { status: 'active', date: { $gte: dhakaDate() } } },
      { $group: { _id: { from: '$from', to: '$to' }, trips: { $sum: 1 }, minPrice: { $min: '$price' } } },
      { $sort: { trips: -1 } },
    ])
    .toArray()
  return rows
    .filter((row) => row._id?.from && row._id?.to)
    .map((row) => ({ from: row._id.from, to: row._id.to, trips: row.trips, minPrice: Number(row.minPrice) || 0 }))
}

/**
 * The routes worth a page in search results: the admin's popular routes, plus any route with
 * a trip on sale, limited to cities still on the list. Popular routes come first.
 */
export async function indexableRoutes(db: Db | null, places: Places): Promise<RouteSummary[]> {
  const live = db ? await routesWithTrips(db).catch(() => []) : []
  const cities = new Set(places.cities)
  const seen = new Set<string>()
  const out: RouteSummary[] = []
  const add = (route: RouteSummary) => {
    const key = `${route.from}→${route.to}`
    if (seen.has(key) || route.from === route.to || !cities.has(route.from) || !cities.has(route.to)) return
    seen.add(key)
    out.push(route)
  }
  for (const route of places.popularRoutes) {
    const match = live.find((r) => r.from === route.from && r.to === route.to)
    add(match ?? { ...route, trips: 0, minPrice: 0 })
  }
  live.forEach(add)
  return out
}
