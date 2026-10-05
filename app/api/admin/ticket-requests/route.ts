import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { contactQuery, nameMatches } from '@/lib/ticketLookup'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Lost-ticket requests for the admin, new ones first, each with the paid tickets its number,
 * email or ticket number points to (checked again now) and whether the name fits. Admin only.
 */
export async function GET() {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { db } = await connectToDatabase()
    const requests = await db.collection('ticketRequests').find({}).sort({ createdAt: -1 }).limit(100).toArray()
    requests.sort((a, b) => Number(a.status !== 'new') - Number(b.status !== 'new'))

    const withMatches = await Promise.all(
      requests.map(async (r) => {
        const query = contactQuery(String(r.contact || ''))
        const found = query
          ? await db
              .collection('bookings')
              .find({ ...query, paymentStatus: 'paid' })
              .project({ bookingCode: 1, passengerName: 1, passengerPhone: 1, passengerEmail: 1, from: 1, to: 1, date: 1, departureTime: 1, seats: 1, companyName: 1, status: 1, checkedIn: 1 })
              .sort({ date: -1 })
              .limit(10)
              .toArray()
          : []
        return {
          ...r,
          _id: String(r._id),
          matches: found.map((b) => ({ ...b, _id: String(b._id), nameMatch: nameMatches(String(r.name || ''), String(b.passengerName || '')) })),
        }
      })
    )
    return NextResponse.json({ requests: withMatches, newCount: requests.filter((r) => r.status === 'new').length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load requests' }, { status: 500 })
  }
}
