import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { summarizeSales } from '@/lib/stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Dashboard totals over every booking. The bookings list is capped at the latest 200, so
 * totals computed from it would quietly undercount revenue and payouts once sales grow.
 */
export async function GET() {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    await repairWronglyExpiredTickets(db)
    const bookings = await db
      .collection('bookings')
      .find(
        { status: { $in: ['confirmed', 'refunded'] } },
        {
          projection: {
            _id: 0,
            paymentStatus: 1,
            status: 1,
            totalPrice: 1,
            commissionAmount: 1,
            companyPayout: 1,
            companyName: 1,
            seats: 1,
            createdAt: 1,
            refundedAt: 1,
            date: 1,
            checkedIn: 1,
            source: 1,
          },
        }
      )
      .toArray()

    return NextResponse.json(summarizeSales(bookings as any), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
