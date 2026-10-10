import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** How far back the "someone just booked" popups look. */
const WINDOW_DAYS = 7
const LIMIT = 12

export interface Activity {
  from: string
  to: string
  seats: number
  /** When the ticket was paid for (ISO). */
  at: string
}

/**
 * Recent paid tickets for the popups on the public pages: only the route, the seat count and
 * when it was bought. Never the passenger's name, phone, seat numbers or ticket code.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const rows = await db
      .collection('bookings')
      .find(
        {
          paymentStatus: 'paid',
          status: 'confirmed',
          $or: [{ paidAt: { $gte: since } }, { paidAt: { $exists: false }, createdAt: { $gte: since } }],
        },
        { projection: { from: 1, to: 1, seats: 1, paidAt: 1, createdAt: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .toArray()

    const activity: Activity[] = rows
      .map((b) => ({
        from: String(b.from || ''),
        to: String(b.to || ''),
        seats: Array.isArray(b.seats) ? b.seats.length : 1,
        at: String(b.paidAt || b.createdAt || ''),
      }))
      .filter((a) => a.from && a.to && a.at)
      .sort((a, b) => b.at.localeCompare(a.at))

    return NextResponse.json(
      { activity },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ activity: [] })
  }
}
