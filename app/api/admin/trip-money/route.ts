import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { dhakaDate, startOfDhakaDay } from '@/lib/scan'
import { ticketLine } from '@/lib/payouts'
import { platesByFleet } from '@/lib/plates'
import { tripDeparted } from '@/lib/trips'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const HISTORY_DAYS = 30
/** How far back ?since=YYYY-MM-DD can reach, for the money sheet. */
const MAX_HISTORY_DAYS = 400

/**
 * Every company's trips from the last 30 days and to come: seats sold (BusHub and counter), the
 * ticket money, BusHub's commission, and what BusHub owes the company for the trip and whether
 * that is paid. A company's own costs are its business and are not shown here.
 */
export async function GET(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { db } = await connectToDatabase()
    const daysBack = (n: number) => dhakaDate(new Date(startOfDhakaDay(dhakaDate()).getTime() - n * 86400000))
    const asked = req.nextUrl.searchParams.get('since') || ''
    let since = daysBack(HISTORY_DAYS)
    if (/^\d{4}-\d{2}-\d{2}$/.test(asked) && asked < since) {
      since = asked < daysBack(MAX_HISTORY_DAYS) ? daysBack(MAX_HISTORY_DAYS) : asked
    }
    const trips = await db
      .collection('buses')
      .find({ status: 'active', date: { $gte: since } })
      .sort({ date: 1, departureTime: 1 })
      .toArray()
    const ids = trips.map((t) => t._id.toString())
    const companyIds = Array.from(new Set(trips.map((t) => String(t.companyId || '')).filter((id) => ObjectId.isValid(id))))
    const [bookings, companies] = await Promise.all([
      db.collection('bookings').find({ busId: { $in: ids }, status: 'confirmed', paymentStatus: 'paid' }).toArray(),
      db
        .collection('companies')
        .find({ _id: { $in: companyIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1 })
        .toArray(),
    ])
    const plates = await platesByFleet(db, trips.map((t) => t.fleetId))
    const payoutIds = Array.from(new Set(bookings.map((b) => b.payoutId).filter((id) => id && ObjectId.isValid(id))))
    const payouts = await db
      .collection('payouts')
      .find({ _id: { $in: payoutIds.map((id) => new ObjectId(id)) } })
      .project({ status: 1, number: 1 })
      .toArray()
    const payoutById = new Map(payouts.map((p) => [p._id.toString(), p]))
    const companyName = new Map(companies.map((c) => [c._id.toString(), String(c.name)]))
    const byTrip = new Map<string, any[]>()
    for (const b of bookings) byTrip.set(b.busId, [...(byTrip.get(b.busId) || []), b])

    return NextResponse.json(
      {
        companies: companies.map((c) => ({ _id: c._id.toString(), name: String(c.name) })).sort((a, b) => a.name.localeCompare(b.name)),
        trips: trips.map((t) => {
          const id = t._id.toString()
          const tickets = byTrip.get(id) || []
          const lines = tickets.map(ticketLine)
          const counterSeats = (t.blockedSeats || []).length
          const onlineSeats = lines.reduce((n, l) => n + l.seats.length, 0)
          const pay = { owed: 0, invoiced: 0, paid: 0, invoiceId: null as string | null, invoiceNumber: null as string | null }
          tickets.forEach((b, i) => {
            const invoice = b.payoutId ? payoutById.get(b.payoutId) : null
            const amount = lines[i].payout
            if (!invoice) pay.owed += amount
            else if (invoice.status === 'paid' || invoice.status === 'confirmed') pay.paid += amount
            else pay.invoiced += amount
            if (invoice) {
              pay.invoiceId = invoice._id.toString()
              pay.invoiceNumber = invoice.number
            }
          })
          return {
            _id: id,
            companyId: String(t.companyId || ''),
            companyName: companyName.get(String(t.companyId || '')) || t.companyName || 'No company',
            fleetId: t.fleetId || null,
            busName: t.busName,
            plateNumber: t.fleetId ? plates.get(String(t.fleetId)) || '' : '',
            from: t.from,
            to: t.to,
            date: t.date,
            departureTime: t.departureTime,
            departed: tripDeparted(t.date, t.departureTime),
            totalSeats: t.totalSeats,
            counter: { seats: counterSeats, total: counterSeats * (t.price || 0) },
            online: {
              tickets: lines.length,
              seats: onlineSeats,
              total: lines.reduce((n, l) => n + l.ticketPrice, 0),
              commission: lines.reduce((n, l) => n + l.commission, 0),
              payout: lines.reduce((n, l) => n + l.payout, 0),
            },
            pay,
          }
        }),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load trip money' }, { status: 500 })
  }
}
