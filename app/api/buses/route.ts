import { NextRequest, NextResponse } from 'next/server'
import { platesByFleet } from '@/lib/plates'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { dhakaDate } from '@/lib/scan'
import { tripDeparted } from '@/lib/trips'
import { createTrip } from '@/lib/tripCreate'

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
    // The admin sees finished trips too, for their sales history. Everyone else sees only
    // trips that have not left yet.
    const all = searchParams.get('all') === '1' && Boolean(getAdminFromCookies())

    const query: Record<string, any> = { status: 'active' }
    if (from) query.from = from
    if (to) query.to = to
    if (date) query.date = date
    if (companyId) query.companyId = companyId

    if (!all) {
      const today = dhakaDate()
      if (date && date < today) return NextResponse.json({ buses: [] }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
      if (!date) query.date = { $gte: today }
    }
    const found = await db.collection('buses').find(query).sort({ departureTime: 1 }).toArray()
    let buses: any[] = all ? found : found.filter((bus) => !tripDeparted(bus.date, bus.departureTime))
    // The admin sees each trip's number plate.
    if (all) {
      const plates = await platesByFleet(db, buses.map((b) => b.fleetId))
      buses = buses.map((b) => ({ ...b, plateNumber: b.fleetId ? plates.get(String(b.fleetId)) || '' : '' }))
    }
    return NextResponse.json({ buses }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
  }
}

/** Adds a trip from the admin panel: any bus on the bus list (lib/tripCreate). */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can add buses' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { db } = await connectToDatabase()
    const result = await createTrip(db, body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create bus' }, { status: 500 })
  }
}
