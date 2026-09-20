import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { isExpired } from '@/lib/tickets'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id)
      ? { _id: new ObjectId(params.id) }
      : { bookingCode: params.id }

    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'confirmed' && isExpired(booking.validUntil)) {
      await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { status: 'expired' } })
      booking.status = 'expired'
    }

    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { paymentStatus, paymentMethod } = body
    if (!paymentStatus) {
      return NextResponse.json({ error: 'Missing paymentStatus' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id)
      ? { _id: new ObjectId(params.id) }
      : { bookingCode: params.id }

    await db.collection('bookings').updateOne(query, { $set: { paymentStatus, paymentMethod } })
    const booking = await db.collection('bookings').findOne(query)
    return NextResponse.json({ booking })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
