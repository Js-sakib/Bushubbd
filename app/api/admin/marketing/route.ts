import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const PERIODS = [7, 30, 90]

/**
 * Online tickets sold per marketing channel (lib/attribution) over the last 7, 30 or 90 days:
 * paid, not refunded. A ticket with no channel came straight to the site, so it is "direct".
 * Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const asked = Number(req.nextUrl.searchParams.get('days'))
    const days = PERIODS.includes(asked) ? asked : 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    const { db } = await connectToDatabase()
    const rows = await db
      .collection('bookings')
      .aggregate([
        { $match: { paymentStatus: 'paid', status: { $ne: 'refunded' }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { channel: { $ifNull: ['$channel', 'direct'] }, campaign: { $ifNull: ['$campaign', ''] } },
            tickets: { $sum: 1 },
            seats: { $sum: { $size: { $ifNull: ['$seats', []] } } },
            sales: { $sum: { $ifNull: ['$totalPrice', 0] } },
            commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
          },
        },
      ])
      .toArray()

    type Totals = { tickets: number; seats: number; sales: number; commission: number }
    const add = (a: Totals, b: Totals) => {
      a.tickets += b.tickets
      a.seats += b.seats
      a.sales += b.sales
      a.commission += b.commission
    }
    const channels = new Map<string, Totals & { channel: string; campaigns: (Totals & { campaign: string })[] }>()
    const total: Totals = { tickets: 0, seats: 0, sales: 0, commission: 0 }
    for (const r of rows) {
      const part = { tickets: r.tickets, seats: r.seats, sales: r.sales, commission: r.commission }
      const channel = String(r._id.channel)
      const entry = channels.get(channel) ?? { channel, tickets: 0, seats: 0, sales: 0, commission: 0, campaigns: [] }
      add(entry, part)
      if (r._id.campaign) entry.campaigns.push({ campaign: String(r._id.campaign), ...part })
      channels.set(channel, entry)
      add(total, part)
    }
    const list = Array.from(channels.values()).sort((a, b) => b.tickets - a.tickets || b.sales - a.sales)
    for (const c of list) c.campaigns.sort((a, b) => b.tickets - a.tickets)

    return NextResponse.json({ days, total, channels: list })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load marketing numbers' }, { status: 500 })
  }
}
