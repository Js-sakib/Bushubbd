import { NextRequest, NextResponse } from 'next/server'
import { ObjectId, type Db } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { getCompanyUser } from '@/lib/staff'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { ScanResult, extractBookingCode, judgeTicket, lastDhakaDays, scansByScanner, startOfDhakaDay, summarizeScans } from '@/lib/scan'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
/** Wrong codes one operator login may enter in ten minutes. */
const SCAN_MISS_LIMIT = 20

interface Scanner {
  /** Whose scans these are: the scanner login, or 'admin'. */
  id: string
  /** The company whose tickets this scanner may board, or 'admin' for any. */
  companyId: string
  name: string
}

/**
 * Only scanner logins (and the BusHub admin) board passengers. The manager sees every scan of the
 * company; counter logins sell seats and have nothing to do here.
 */
async function currentScanner(db: Db): Promise<Scanner | 'forbidden' | null> {
  const user = await getCompanyUser(db)
  if (user) {
    if (user.role !== 'scanner' || !user.staffId) return 'forbidden'
    return { id: user.staffId, companyId: user.companyId, name: user.name }
  }
  return getAdminFromCookies() ? { id: 'admin', companyId: 'admin', name: 'BusHub admin' } : null
}

/**
 * Scan one ticket at the bus door. A genuine, paid ticket for this operator's bus, for today,
 * that has not boarded yet is checked in on the spot; every other outcome says why not.
 * Every scan is logged, so the operator's daily and weekly counts come from real scans.
 */
export async function POST(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const scanner = await currentScanner(db)
    if (!scanner) {
      return NextResponse.json({ error: 'Please log in to scan tickets' }, { status: 401 })
    }
    if (scanner === 'forbidden') {
      return NextResponse.json({ error: 'Scanning needs a Scanner login. Your manager can add one.' }, { status: 403 })
    }

    const { text } = await req.json().catch(() => ({ text: '' }))
    const bookingCode = extractBookingCode(String(text || ''))
    const now = new Date()

    const respond = async (result: ScanResult, booking?: any, busCompanyId?: string, checkedInAt?: string) => {
      await db.collection('scans').insertOne({
        scannerId: scanner.id,
        scannerName: scanner.name,
        companyId: scanner.companyId,
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
                bags: typeof booking.bags === 'number' ? booking.bags : null,
                checkedInAt: checkedInAt || booking.checkedInAt || null,
              }
            : null,
        },
        { headers: NO_STORE }
      )
    }

    // After too many codes that match no ticket, this login waits: nobody can try codes one
    // after another until a real one turns up.
    const missKey = `scan:${scanner.id}`
    if (await tooManyMisses(db, missKey, SCAN_MISS_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many wrong codes. Wait 10 minutes, then scan again.' },
        { status: 429, headers: NO_STORE }
      )
    }
    const miss = async () => {
      await recordMiss(db, missKey)
      return respond('not_found')
    }

    if (!bookingCode) return miss()

    await repairWronglyExpiredTickets(db, { bookingCode })
    const booking = await db.collection('bookings').findOne({ bookingCode })
    if (!booking) return miss()

    const bus = ObjectId.isValid(booking.busId)
      ? await db.collection('buses').findOne({ _id: new ObjectId(booking.busId) }, { projection: { companyId: 1 } })
      : null
    const busCompanyId = bus?.companyId as string | undefined

    const verdict = judgeTicket(booking as any, busCompanyId, scanner.companyId, now)
    if (verdict !== 'valid') return respond(verdict, booking, busCompanyId)

    // Only one scan can win, so the same ticket cannot board twice from two phones at once.
    const checkedInAt = now.toISOString()
    const boarded = await db
      .collection('bookings')
      .updateOne(
        { _id: booking._id, checkedIn: { $ne: true } },
        { $set: { checkedIn: true, checkedInAt, checkedInBy: scanner.id, checkedInByName: scanner.name } }
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

/**
 * Today's and the last seven days' boardings, plus recent scans: a scanner sees its own, the
 * company manager sees every scanner of the company (and scans from before staff logins).
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    let filter: Record<string, unknown>
    if (user?.role === 'scanner' && user.staffId) filter = { scannerId: user.staffId }
    else if (user?.role === 'manager') filter = { $or: [{ companyId: user.companyId }, { scannerId: user.companyId }] }
    else if (!user && getAdminFromCookies()) filter = {}
    else return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const days = lastDhakaDays(7)
    const since = startOfDhakaDay(days[0]).toISOString()
    const scans = await db
      .collection('scans')
      .find({ ...filter, scannedAt: { $gte: since } })
      .sort({ scannedAt: -1 })
      .limit(2000)
      .toArray()

    return NextResponse.json(
      {
        ...summarizeScans(scans as any),
        // Who scanned what, for the manager; scans from before staff logins were made by the main login.
        ...(user?.role === 'scanner' ? {} : { byScanner: scansByScanner(scans as any, 'Main login (old scans)') }),
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
          scannerName: s.scannerName || null,
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
