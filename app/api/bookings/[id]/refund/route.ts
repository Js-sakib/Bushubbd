import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Refunds a paid ticket and puts its seats back on sale. Admin only: bus companies ask the
 * BusHub team. The status change is one conditional update, so the same ticket can't be
 * refunded twice, and a passenger who has already boarded keeps their seat.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can refund tickets' }, { status: 403 })
    }

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id) ? { _id: new ObjectId(params.id) } : { bookingCode: params.id }
    await repairWronglyExpiredTickets(db, query)

    const refundedAt = new Date().toISOString()
    const result = await db
      .collection('bookings')
      .updateOne(
        { ...query, paymentStatus: 'paid', status: 'confirmed', checkedIn: { $ne: true } },
        { $set: { status: 'refunded', refundedAt } }
      )
    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (result.modifiedCount === 0) {
      const error = booking.checkedIn
        ? 'This passenger has already boarded, so the ticket cannot be refunded'
        : booking.status === 'refunded'
          ? 'This ticket is already refunded'
          : 'Only a paid, confirmed booking can be refunded'
      return NextResponse.json({ error }, { status: 409 })
    }

    await db
      .collection('buses')
      .updateOne({ _id: new ObjectId(booking.busId) }, { $pull: { bookedSeats: { $in: booking.seats } } } as any)

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to refund booking' }, { status: 500 })
  }
}
