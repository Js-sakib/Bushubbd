import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { seatSelectionError } from '@/lib/seats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change seats' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }

    const { seats, action } = await req.json()
    if (!Array.isArray(seats) || seats.length === 0 || !['block', 'unblock'].includes(action)) {
      return NextResponse.json(
        { error: 'Provide seats (array) and action ("block" or "unblock")' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const seatProblem = seatSelectionError(seats, bus.totalSeats, bus.totalSeats)
    if (seatProblem) {
      return NextResponse.json({ error: seatProblem }, { status: 400 })
    }

    await repairWronglyExpiredTickets(db, { busId: params.id })

    // A seat is only truly sold on BusHub when a live booking claims it. Those seats belong to a
    // paying passenger and must never be edited from here, or the seat could be sold twice.
    const liveBookings = await db
      .collection('bookings')
      .find({ busId: params.id, status: { $in: ['pending', 'confirmed'] }, seats: { $in: seats } })
      .toArray()
    const clash = seats.find((seat: string) => liveBookings.some((b) => (b.seats || []).includes(seat)))
    if (clash) {
      return NextResponse.json(
        { error: `Seat ${clash} is sold on BusHub. Refund that ticket to free the seat.` },
        { status: 409 }
      )
    }

    const update =
      action === 'block'
        ? { $addToSet: { blockedSeats: { $each: seats } } }
        : // Also clear any leftover bookedSeats entry with no booking behind it — seats marked sold
          // by hand before counter sales had their own list.
          { $pull: { blockedSeats: { $in: seats }, bookedSeats: { $in: seats } } }

    // Blocking only goes through if no customer grabbed one of these seats a moment ago.
    const filter =
      action === 'block' ? { _id: new ObjectId(params.id), bookedSeats: { $nin: seats } } : { _id: new ObjectId(params.id) }
    const result = await db.collection('buses').updateOne(filter, update as any)
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'One of these seats was just sold on BusHub. Refresh and try again.' }, { status: 409 })
    }

    const updated = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    return NextResponse.json(
      { bus: updated },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 })
  }
}
