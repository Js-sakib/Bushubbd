import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { cleanLogoUrl } from '@/lib/names'

export const dynamic = 'force-dynamic'

/**
 * Only the logo can change once a bus is listed. Its name, owner and seats are what tickets
 * were sold under, so changing them would make old tickets disagree with the bus.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const logoUrl = cleanLogoUrl(body.logoUrl)
    if (logoUrl === null) {
      return NextResponse.json({ error: 'The logo must be a web link starting with https://' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const result = await db
      .collection('fleet')
      .updateOne({ _id: new ObjectId(params.id) }, logoUrl ? { $set: { logoUrl } } : { $unset: { logoUrl: '' } })
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Trips and their tickets show the new logo too.
    const trips = await db.collection('buses').find({ fleetId: params.id }).project({ _id: 1 }).toArray()
    const change = logoUrl ? { $set: { logoUrl } } : { $unset: { logoUrl: '' } }
    await db.collection('buses').updateMany({ fleetId: params.id }, change)
    await db.collection('bookings').updateMany({ busId: { $in: trips.map((t) => t._id.toString()) } }, change)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update the bus' }, { status: 500 })
  }
}

/** A listed bus can be removed only while no trip uses it. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    const trips = await db.collection('buses').countDocuments({ fleetId: params.id })
    if (trips > 0) {
      return NextResponse.json(
        { error: `This bus has ${trips} trip${trips === 1 ? '' : 's'}, so it stays on the list` },
        { status: 409 }
      )
    }
    await db.collection('fleet').deleteOne({ _id: new ObjectId(params.id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove the bus' }, { status: 500 })
  }
}
