import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { cleanLogoUrl, cleanPlate, plateKey } from '@/lib/names'
import { dhakaDate } from '@/lib/scan'
import { tripDeparted } from '@/lib/trips'

export const dynamic = 'force-dynamic'

/**
 * Only the logo, the number plate and BusHub's commission can change once a bus is listed. Its
 * name, owner and seats are what tickets were sold under, so changing them would make old tickets
 * disagree with the bus.
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

    if (body.plateNumber !== undefined) {
      const plateNumber = cleanPlate(body.plateNumber)
      if (plateNumber === null) {
        return NextResponse.json({ error: 'Type the number plate, e.g. DHAKA METRO-BA 11-2345' }, { status: 400 })
      }
      const { db } = await connectToDatabase()
      try {
        const result = await db
          .collection('fleet')
          .updateOne(
            { _id: new ObjectId(params.id) },
            plateNumber ? { $set: { plateNumber, plateKey: plateKey(plateNumber) } } : { $unset: { plateNumber: '', plateKey: '' } }
          )
        if (result.matchedCount === 0) return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err
        const other = await db.collection('fleet').findOne({ plateKey: plateKey(plateNumber || '') })
        return NextResponse.json({ error: `Plate ${plateNumber} is already on ${other?.name || 'another bus'}` }, { status: 409 })
      }
      return NextResponse.json({ success: true, plateNumber: plateNumber || null })
    }

    if (body.commissionRate !== undefined) {
      const commissionRate = Number(body.commissionRate)
      if (body.commissionRate === '' || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 50) {
        return NextResponse.json({ error: 'Commission must be between 0 and 50%' }, { status: 400 })
      }
      const { db } = await connectToDatabase()
      const result = await db.collection('fleet').updateOne({ _id: new ObjectId(params.id) }, { $set: { commissionRate } })
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
      }
      // Trips still to come use the new rate from their next sale. Tickets already sold keep
      // the split they were sold with, and finished trips keep theirs.
      await db
        .collection('buses')
        .updateMany({ fleetId: params.id, date: { $gte: dhakaDate() } }, { $set: { commissionRate } })
      return NextResponse.json({ success: true })
    }

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

/**
 * A listed bus can be removed once none of its trips is still to come. Its finished trips and
 * their tickets stay, with the bus name written on them.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    const trips = await db
      .collection('buses')
      .find({ fleetId: params.id, status: 'active', date: { $gte: dhakaDate() } })
      .project({ date: 1, departureTime: 1 })
      .toArray()
    const upcoming = trips.filter((t) => !tripDeparted(t.date, t.departureTime)).length
    if (upcoming > 0) {
      return NextResponse.json(
        { error: `This bus has ${upcoming} upcoming trip${upcoming === 1 ? '' : 's'}. Delete ${upcoming === 1 ? 'it' : 'them'} first.` },
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
