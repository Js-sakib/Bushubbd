import type { Db } from 'mongodb'

export interface PopularRoute {
  from: string
  to: string
}

export interface Places {
  cities: string[]
  popularRoutes: PopularRoute[]
}

/** What the site shows until the admin changes the list. */
export const DEFAULT_PLACES: Places = {
  cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur'],
  popularRoutes: [
    { from: 'Dhaka', to: 'Sylhet' },
    { from: 'Dhaka', to: "Cox's Bazar" },
    { from: 'Dhaka', to: 'Chittagong' },
    { from: 'Dhaka', to: 'Rajshahi' },
  ],
}

export const MAX_POPULAR_ROUTES = 8

/** The admin's city list and home-page routes, kept in one settings document. */
export async function getPlaces(db: Db): Promise<Places> {
  const doc = await db.collection('settings').findOne({ _id: 'places' as any })
  return {
    cities: Array.isArray(doc?.cities) ? doc!.cities : DEFAULT_PLACES.cities,
    popularRoutes: Array.isArray(doc?.popularRoutes) ? doc!.popularRoutes : DEFAULT_PLACES.popularRoutes,
  }
}

export async function savePlaces(db: Db, places: Places) {
  await db
    .collection('settings')
    .updateOne({ _id: 'places' as any }, { $set: { ...places, updatedAt: new Date().toISOString() } }, { upsert: true })
}
