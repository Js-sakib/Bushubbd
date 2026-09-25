import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

/**
 * Rules the database enforces itself, so a duplicate can't slip in even if two requests race:
 * a ticket code belongs to one ticket, and a bus name is listed once. Created once per server
 * start; createIndex is a no-op when the index already exists.
 */
async function ensureIndexes(db: Db) {
  const indexes: [string, Record<string, 1>, { name: string } & Record<string, unknown>][] = [
    ['bookings', { bookingCode: 1 }, { unique: true, name: 'bookingCode_unique' }],
    ['fleet', { nameKey: 1 }, { unique: true, name: 'fleet_name_unique' }],
    [
      'buses',
      { fleetId: 1, date: 1, departureTime: 1 },
      { unique: true, name: 'fleet_trip_unique', partialFilterExpression: { fleetId: { $exists: true }, status: 'active' } },
    ],
    ['bookings', { busId: 1, status: 1 }, { name: 'bus_bookings' }],
    ['leads', { nameKey: 1 }, { unique: true, name: 'lead_name_unique' }],
  ]
  for (const [collection, key, options] of indexes) {
    try {
      await db.collection(collection).createIndex(key, options)
    } catch (err) {
      // Existing duplicate data stops a unique index from being built; the app-level checks still
      // apply, and the log says what needs cleaning up.
      console.error(`Could not create index ${String(options.name)} on ${collection}`, err)
    }
  }
}

export async function connectToDatabase() {
  if (cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const client = new MongoClient(process.env.MONGODB_URI!)
  await client.connect()

  const db = client.db('bushubbd')

  // Create collections if they don't exist
  const collections = await db.listCollections().toArray()
  const collectionNames = collections.map((c) => c.name)
  for (const name of ['buses', 'bookings', 'companies', 'payments', 'sessions', 'fleet', 'leads']) {
    if (!collectionNames.includes(name)) {
      await db.createCollection(name)
    }
  }
  await ensureIndexes(db)

  cachedClient = client
  cachedDb = db

  return { client, db }
}

/** True for MongoDB's "that value is already taken" error on a unique index. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000
}
