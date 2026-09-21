import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = getCompanyFromCookies()
    const admin = getAdminFromCookies()
    if (!company && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id) ? { _id: new ObjectId(params.id) } : { bookingCode: params.id }
    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (company) {
      const bus = await db.collection('buses').findOne({ _id: new ObjectId(booking.busId) })
      if (!bus || bus.companyId !== company.companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    if (booking.paymentStatus !== 'paid' || booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only a paid, confirmed booking can be refunded' }, { status: 409 })
    }

    const refundedAt = new Date().toISOString()
    await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { status: 'refunded', refundedAt } })
    await db.collection('buses').updateOne(
      { _id: new ObjectId(booking.busId) },
      { $pull: { bookedSeats: { $in: booking.seats } } } as any
    )

    const updated = await db.collection('bookings').findOne({ _id: booking._id })
    return NextResponse.json({ booking: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to refund booking' }, { status: 500 })
  }
}
