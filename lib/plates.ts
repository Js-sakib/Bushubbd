import { ObjectId, type Db } from 'mongodb'

/** Number plates of the given buses (fleet ids), for showing next to their trips. */
export async function platesByFleet(db: Db, fleetIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(fleetIds.filter((id): id is string => Boolean(id) && ObjectId.isValid(String(id)))))
  if (ids.length === 0) return new Map()
  const rows = await db
    .collection('fleet')
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) }, plateNumber: { $type: 'string' } })
    .project({ plateNumber: 1 })
    .toArray()
  return new Map(rows.map((r) => [r._id.toString(), String(r.plateNumber)]))
}

/** Number plates by trip id, for lists of tickets. */
export async function platesByTrip(db: Db, tripIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(tripIds.filter((id) => ObjectId.isValid(id))))
  if (ids.length === 0) return new Map()
  const trips = await db
    .collection('buses')
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .project({ fleetId: 1 })
    .toArray()
  const plates = await platesByFleet(db, trips.map((t) => t.fleetId))
  const out = new Map<string, string>()
  for (const t of trips) {
    const plate = t.fleetId ? plates.get(String(t.fleetId)) : undefined
    if (plate) out.set(t._id.toString(), plate)
  }
  return out
}
