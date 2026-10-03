import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { platesByTrip } from '@/lib/plates'
import { startOfDhakaDay } from '@/lib/scan'

export const dynamic = 'force-dynamic'

/** The most bookings one request returns; a sheet of a year of tickets fits well under this. */
const MAX_ROWS = 20000
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Every booking in a date range with the customer's full details, for the admin's Bookings list
 * and its Excel sheet: ?from=YYYY-MM-DD&to=YYYY-MM-DD, by travel date (default) or by the day it
 * was bought (&by=booked). The plain bookings list only has the latest 200.
 */
export async function GET(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const params = req.nextUrl.searchParams
    const from = params.get('from') || ''
    const to = params.get('to') || ''
    const byBooked = params.get('by') === 'booked'
    if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
      return NextResponse.json({ error: 'Dates must look like 2026-10-03' }, { status: 400 })
    }
    const range: Record<string, string> = {}
    if (byBooked) {
      if (from) range.$gte = startOfDhakaDay(from).toISOString()
      if (to) range.$lt = new Date(startOfDhakaDay(to).getTime() + 86400000).toISOString()
    } else {
      if (from) range.$gte = from
      if (to) range.$lte = to
    }
    const query = Object.keys(range).length ? { [byBooked ? 'createdAt' : 'date']: range } : {}

    const { db } = await connectToDatabase()
    const found = await db.collection('bookings').find(query, { projection: { qrCode: 0, phoneKey: 0 } }).sort({ createdAt: -1 }).limit(MAX_ROWS + 1).toArray()
    const rows = found.slice(0, MAX_ROWS)
    const payoutIds = Array.from(new Set(rows.map((b) => b.payoutId).filter((id) => id && ObjectId.isValid(id))))
    const [plates, payouts] = await Promise.all([
      platesByTrip(db, rows.map((b) => String(b.busId || ''))),
      db
        .collection('payouts')
        .find({ _id: { $in: payoutIds.map((id) => new ObjectId(id)) } })
        .project({ number: 1, status: 1 })
        .toArray(),
    ])
    const invoice = new Map(payouts.map((p) => [p._id.toString(), p]))

    return NextResponse.json(
      {
        truncated: found.length > MAX_ROWS,
        bookings: rows.map((b) => ({
          ...b,
          _id: b._id.toString(),
          plateNumber: plates.get(String(b.busId || '')) || '',
          invoiceNumber: b.payoutId ? invoice.get(b.payoutId)?.number || '' : '',
          invoiceStatus: b.payoutId ? invoice.get(b.payoutId)?.status || '' : '',
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}
