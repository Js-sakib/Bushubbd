import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { releaseExpiredHolds } from '@/lib/seatHold'
import { generateSeatLabels } from '@/lib/seats'
import { ticketExpiry } from '@/lib/tickets'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    await releaseExpiredHolds(db, params.id)
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }
    return NextResponse.json({ bus }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch bus' }, { status: 500 })
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Changes a trip's route, time, fare or status. The bus name, company, type and seat count
 * come from the bus list and can't be typed here. An older trip with no bus-list entry can be
 * linked to one (fleetId), which also renames its existing tickets to match.
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
    const allowedFields = ['from', 'to', 'date', 'departureTime', 'arrivalTime', 'price', 'status', 'commissionRate']
    const update: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) update[key] = body[key]
    }
    if (update.date !== undefined && !DATE.test(String(update.date))) {
      return NextResponse.json({ error: 'Check the date' }, { status: 400 })
    }
    for (const key of ['departureTime', 'arrivalTime']) {
      if (update[key] !== undefined && update[key] !== '' && !TIME.test(String(update[key]))) {
        return NextResponse.json({ error: 'Check the times' }, { status: 400 })
      }
    }
    if (update.price !== undefined) {
      update.price = Number(update.price)
      if (!Number.isFinite(update.price) || update.price <= 0) {
        return NextResponse.json({ error: 'Enter the fare' }, { status: 400 })
      }
    }
    if (update.status !== undefined && !['active', 'cancelled'].includes(update.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const ticketChanges: Record<string, any> = {}
    if (body.fleetId !== undefined) {
      if (bus.fleetId) {
        return NextResponse.json({ error: 'This trip is already linked to a bus on your list' }, { status: 409 })
      }
      const fleetBus = ObjectId.isValid(body.fleetId)
        ? await db.collection('fleet').findOne({ _id: new ObjectId(body.fleetId) })
        : null
      if (!fleetBus) {
        return NextResponse.json({ error: 'Choose a bus from your bus list' }, { status: 400 })
      }
      // Seats already sold or blocked must still exist on the bus it's linked to.
      const seatsInUse: string[] = [...(bus.bookedSeats || []), ...(bus.blockedSeats || [])]
      const missing = seatsInUse.find((seat) => !generateSeatLabels(fleetBus.totalSeats).includes(seat))
      if (missing) {
        return NextResponse.json(
          { error: `Seat ${missing} is taken on this trip but ${fleetBus.name} has only ${fleetBus.totalSeats} seats` },
          { status: 409 }
        )
      }
      Object.assign(update, {
        fleetId: fleetBus._id.toString(),
        busName: fleetBus.name,
        companyId: fleetBus.companyId,
        companyName: fleetBus.companyName,
        busType: fleetBus.busType,
        totalSeats: fleetBus.totalSeats,
        logoUrl: fleetBus.logoUrl ?? null,
      })
      Object.assign(ticketChanges, { busName: fleetBus.name, companyName: fleetBus.companyName, logoUrl: fleetBus.logoUrl ?? null })
    }

    // Tickets already sold show the trip's new route and time.
    for (const key of ['from', 'to', 'date', 'departureTime']) {
      if (update[key] !== undefined) ticketChanges[key] = update[key]
    }
    if (ticketChanges.date) ticketChanges.validUntil = ticketExpiry(ticketChanges.date)

    try {
      await db.collection('buses').updateOne({ _id: bus._id }, { $set: update })
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      return NextResponse.json({ error: 'That bus already has a trip at this date and time' }, { status: 409 })
    }
    if (Object.keys(ticketChanges).length > 0) {
      await db.collection('bookings').updateMany({ busId: params.id }, { $set: ticketChanges })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update bus' }, { status: 500 })
  }
}

/** A trip with live tickets can't be deleted: refund them first, or those passengers could not board. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    const live = await db.collection('bookings').countDocuments({ busId: params.id, status: { $in: ['pending', 'confirmed'] } })
    if (live > 0) {
      return NextResponse.json({ error: `This trip has ${live} live ticket${live === 1 ? '' : 's'}. Refund them first.` }, { status: 409 })
    }
    await db.collection('buses').deleteOne({ _id: new ObjectId(params.id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete bus' }, { status: 500 })
  }
}
