import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies, getCompanyFromCookies } from '@/lib/auth'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { ScanResult, extractBookingCode, judgeTicket, lastDhakaDays, startOfDhakaDay, summarizeScans } from '@/lib/scan'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

function scannerId(): string | null {
  const company = getCompanyFromCookies()
  if (company) return company.companyId
  return getAdminFromCookies() ? 'admin' : null
}

/**
 * Scan one ticket at the bus door. A genuine, paid ticket for this operator's bus, for today,
 * that has not boarded yet is checked in on the spot; every other outcome says why not.
 * Every scan is logged, so the operator's daily and weekly counts come from real scans.
 */
export async function POST(req: NextRequest) {
  try {
    const scanner = scannerId()
    if (!scanner) {
      return NextResponse.json({ error: 'Please log in to scan tickets' }, { status: 401 })
    }

    const { text } = await req.json().catch(() => ({ text: '' }))
    const bookingCode = extractBookingCode(String(text || ''))
    const { db } = await connectToDatabase()
    const now = new Date()

    const respond = async (result: ScanResult, booking?: any, busCompanyId?: string, checkedInAt?: string) => {
      await db.collection('scans').insertOne({
        scannerId: scanner,
        busCompanyId: busCompanyId || null,
        bookingCode: bookingCode || null,
        bookingId: booking?._id?.toString() || null,
        busName: booking?.busName || null,
        from: booking?.from || null,
        to: booking?.to || null,
        travelDate: booking?.date || null,
        departureTime: booking?.departureTime || null,
        seatCount: booking?.seats?.length || 0,
        result,
        scannedAt: now.toISOString(),
      })

      // Another operator's passenger details are none of this scanner's business.
      const showTicket = booking && result !== 'other_operator'
      return NextResponse.json(
        {
          result,
          bookingCode,
          ticket: showTicket
            ? {
                bookingCode: booking.bookingCode,
                passengerName: booking.passengerName,
                busName: booking.busName,
                companyName: booking.companyName,
                from: booking.from,
                to: booking.to,
                date: booking.date,
                departureTime: booking.departureTime,
                seats: booking.seats || [],
                checkedInAt: checkedInAt || booking.checkedInAt || null,
              }
            : null,
        },
        { headers: NO_STORE }
      )
    }

    if (!bookingCode) return respond('not_found')

    await repairWronglyExpiredTickets(db, { bookingCode })
    const booking = await db.collection('bookings').findOne({ bookingCode })
    if (!booking) return respond('not_found')

    const bus = ObjectId.isValid(booking.busId)
      ? await db.collection('buses').findOne({ _id: new ObjectId(booking.busId) }, { projection: { companyId: 1 } })
      : null
    const busCompanyId = bus?.companyId as string | undefined

    const verdict = judgeTicket(booking as any, busCompanyId, scanner, now)
    if (verdict !== 'valid') return respond(verdict, booking, busCompanyId)

    // Only one scan can win, so the same ticket cannot board twice from two phones at once.
    const checkedInAt = now.toISOString()
    const boarded = await db
      .collection('bookings')
      .updateOne(
        { _id: booking._id, checkedIn: { $ne: true } },
        { $set: { checkedIn: true, checkedInAt, checkedInBy: scanner } }
      )
    if (boarded.modifiedCount === 0) {
      const latest = await db.collection('bookings').findOne({ _id: booking._id })
      return respond('already_used', latest || booking, busCompanyId)
    }
    return respond('valid', booking, busCompanyId, checkedInAt)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not check the ticket, please try again' }, { status: 500 })
  }
}

/** Today's and the last seven days' boardings for this scanner, plus recent scans. */
export async function GET() {
  try {
    const scanner = scannerId()
    if (!scanner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const days = lastDhakaDays(7)
    const since = startOfDhakaDay(days[0]).toISOString()
    const { db } = await connectToDatabase()
    const filter = scanner === 'admin' ? {} : { scannerId: scanner }
    const scans = await db
      .collection('scans')
      .find({ ...filter, scannedAt: { $gte: since } })
      .sort({ scannedAt: -1 })
      .limit(2000)
      .toArray()

    return NextResponse.json(
      {
        ...summarizeScans(scans as any),
        recent: scans.slice(0, 50).map((s) => ({
          id: s._id.toString(),
          bookingCode: s.bookingCode,
          result: s.result,
          busName: s.busName,
          from: s.from,
          to: s.to,
          travelDate: s.travelDate,
          departureTime: s.departureTime,
          seatCount: s.seatCount,
          scannedAt: s.scannedAt,
        })),
      },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load scan history' }, { status: 500 })
  }
}
