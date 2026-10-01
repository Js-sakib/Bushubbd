import type { Db } from 'mongodb'
import { dhakaDate, startOfDhakaDay } from './scan'
import { tripDeparted } from './trips'
import type { TripCost } from './tripMoney'

/** How long a bus staff member can take back a cost they entered by mistake. */
export const UNDO_MINUTES = 60

/** The trips a scanner (bus staff) login may enter costs for: yesterday, today and tomorrow. */
export function staffCostWindow(at: Date = new Date()): { from: string; to: string } {
  const today = startOfDhakaDay(dhakaDate(at)).getTime()
  return { from: dhakaDate(new Date(today - 86400000)), to: dhakaDate(new Date(today + 86400000)) }
}

export function costRow(c: any): TripCost {
  return {
    _id: c._id.toString(),
    busId: c.busId,
    type: c.type,
    amount: c.amount,
    note: c.note || '',
    addedBy: c.addedBy,
    staffId: c.staffId || null,
    role: c.role,
    createdAt: c.createdAt,
  }
}

export async function costsForTrips(db: Db, tripIds: string[]): Promise<TripCost[]> {
  if (tripIds.length === 0) return []
  const rows = await db.collection('tripCosts').find({ busId: { $in: tripIds } }).sort({ createdAt: 1 }).toArray()
  return rows.map(costRow)
}

/** A trip as the bus staff's cost page lists it. */
export function costTrip(t: any) {
  return {
    _id: t._id.toString(),
    busName: t.busName,
    from: t.from,
    to: t.to,
    date: t.date,
    departureTime: t.departureTime,
    departed: tripDeparted(t.date, t.departureTime),
  }
}
