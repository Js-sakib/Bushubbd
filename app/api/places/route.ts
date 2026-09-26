import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { MAX_POPULAR_ROUTES, getPlaces, savePlaces } from '@/lib/places'
import { cleanName, nameKey } from '@/lib/names'
import { dhakaDate } from '@/lib/scan'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** The cities customers can pick and the popular routes on the home page. Public. */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    return NextResponse.json(await getPlaces(db), { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load cities' }, { status: 500 })
  }
}

/**
 * Admin changes to the lists, one action at a time:
 * addCity, removeCity, addRoute, removeRoute, moveRoute (up by one).
 */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change cities' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { db } = await connectToDatabase()
    const places = await getPlaces(db)
    const find = (name: string) => places.cities.find((c) => nameKey(c) === nameKey(name))
    const sameRoute = (a: { from: string; to: string }, b: { from: string; to: string }) =>
      nameKey(a.from) === nameKey(b.from) && nameKey(a.to) === nameKey(b.to)

    switch (body.action) {
      case 'addCity': {
        // "kuakata" → "Kuakata"; words already capitalised by the admin are kept as typed.
        const city = cleanName(body.city).replace(/(^|\s)([a-z])/g, (_m, space: string, letter: string) => space + letter.toUpperCase())
        if (city.length < 2 || city.length > 40) {
          return NextResponse.json({ error: 'Enter the city name' }, { status: 400 })
        }
        const existing = find(city)
        if (existing) {
          return NextResponse.json({ error: `${existing} is already on the list` }, { status: 409 })
        }
        places.cities = [...places.cities, city]
        break
      }
      case 'removeCity': {
        const city = find(String(body.city || ''))
        if (!city) {
          return NextResponse.json({ error: 'That city is not on the list' }, { status: 404 })
        }
        // A city with upcoming trips must stay, or customers couldn't search for those buses.
        const upcoming = await db
          .collection('buses')
          .countDocuments({ status: 'active', date: { $gte: dhakaDate() }, $or: [{ from: city }, { to: city }] })
        if (upcoming > 0) {
          return NextResponse.json(
            { error: `${city} has ${upcoming} upcoming trip${upcoming === 1 ? '' : 's'}, so it stays` },
            { status: 409 }
          )
        }
        places.cities = places.cities.filter((c) => c !== city)
        places.popularRoutes = places.popularRoutes.filter((r) => r.from !== city && r.to !== city)
        break
      }
      case 'addRoute': {
        const from = find(String(body.from || ''))
        const to = find(String(body.to || ''))
        if (!from || !to || from === to) {
          return NextResponse.json({ error: 'Choose two different cities from the list' }, { status: 400 })
        }
        if (places.popularRoutes.some((r) => sameRoute(r, { from, to }))) {
          return NextResponse.json({ error: `${from} → ${to} is already a popular route` }, { status: 409 })
        }
        if (places.popularRoutes.length >= MAX_POPULAR_ROUTES) {
          return NextResponse.json(
            { error: `The home page shows up to ${MAX_POPULAR_ROUTES} routes. Remove one first.` },
            { status: 409 }
          )
        }
        places.popularRoutes = [...places.popularRoutes, { from, to }]
        break
      }
      case 'removeRoute':
      case 'moveRoute': {
        const index = places.popularRoutes.findIndex((r) =>
          sameRoute(r, { from: String(body.from || ''), to: String(body.to || '') })
        )
        if (index < 0) {
          return NextResponse.json({ error: 'That route is not on the list' }, { status: 404 })
        }
        const routes = [...places.popularRoutes]
        if (body.action === 'removeRoute') {
          routes.splice(index, 1)
        } else if (index > 0) {
          ;[routes[index - 1], routes[index]] = [routes[index], routes[index - 1]]
        }
        places.popularRoutes = routes
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await savePlaces(db, places)
    return NextResponse.json(places)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save cities' }, { status: 500 })
  }
}
