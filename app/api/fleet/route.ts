import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { FleetBus } from '@/lib/models'
import { BUS_TYPES, MAX_BUS_SEATS, cleanLogoUrl, cleanName, nameKey } from '@/lib/names'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

/** The admin's list of buses, each with how many trips use it (a bus with trips can't be removed). */
export async function GET() {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { db } = await connectToDatabase()
    const [fleet, counts] = await Promise.all([
      db.collection('fleet').find({}).sort({ nameKey: 1 }).toArray(),
      db
        .collection('buses')
        .aggregate([{ $match: { fleetId: { $exists: true } } }, { $group: { _id: '$fleetId', n: { $sum: 1 } } }])
        .toArray(),
    ])
    const trips = new Map(counts.map((c) => [String(c._id), c.n as number]))
    return NextResponse.json(
      { fleet: fleet.map((f) => ({ ...f, tripCount: trips.get(f._id.toString()) || 0 })) },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load the bus list' }, { status: 500 })
  }
}

/** Lists a bus once: its name, the company that owns it, its type and seat count. */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can list buses' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const name = cleanName(body.name)
    const totalSeats = Number(body.totalSeats)
    const busType = BUS_TYPES.includes(body.busType) ? body.busType : null
    const logoUrl = cleanLogoUrl(body.logoUrl)

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'Give the bus a name (2 to 60 letters)' }, { status: 400 })
    }
    if (!busType) {
      return NextResponse.json({ error: 'Choose the bus type' }, { status: 400 })
    }
    if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > MAX_BUS_SEATS) {
      return NextResponse.json({ error: `Seats must be a whole number from 1 to ${MAX_BUS_SEATS}` }, { status: 400 })
    }
    if (logoUrl === null) {
      return NextResponse.json({ error: 'The logo must be a web link starting with https://' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const company =
      typeof body.companyId === 'string' && ObjectId.isValid(body.companyId)
        ? await db.collection('companies').findOne({ _id: new ObjectId(body.companyId), status: 'approved' })
        : null
    if (!company) {
      return NextResponse.json({ error: 'Choose an approved bus company' }, { status: 400 })
    }

    const bus: FleetBus = {
      name,
      nameKey: nameKey(name),
      companyId: company._id.toString(),
      companyName: company.name,
      busType,
      totalSeats,
      logoUrl,
      createdAt: new Date().toISOString(),
    }
    try {
      const result = await db.collection('fleet').insertOne({ ...bus } as any)
      return NextResponse.json({ bus: { ...bus, _id: result.insertedId, tripCount: 0 } }, { status: 201 })
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      const existing = await db.collection('fleet').findOne({ nameKey: bus.nameKey })
      return NextResponse.json(
        { error: `"${existing?.name || name}" is already on the list${existing ? ` (${existing.companyName})` : ''}` },
        { status: 409 }
      )
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list the bus' }, { status: 500 })
  }
}
