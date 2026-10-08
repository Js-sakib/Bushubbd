import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { counterDay, sellCounterTicket, ticketsForPhone } from '@/lib/counterTickets'
import { dhakaDate } from '@/lib/scan'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }

async function seller() {
  const { db } = await connectToDatabase()
  const user = await getCompanyUser(db)
  if (!user || (user.role !== 'manager' && user.role !== 'counter')) return { db, user: null }
  return { db, user }
}

/** Sell seats at the counter as one printed ticket (passenger, fare, cash/bKash/Nagad). */
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await seller()
    if (!user) return NextResponse.json({ error: 'Only the manager or a counter can sell tickets' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const result = await sellCounterTicket(db, body, {
      kind: 'company',
      companyId: user.companyId,
      role: user.role as 'manager' | 'counter',
      staffId: user.staffId,
      name: user.name,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE })
    return NextResponse.json({ ticket: result.value }, { status: 201, headers: NO_STORE })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not sell the ticket, please try again' }, { status: 500 })
  }
}

/**
 * ?day=YYYY-MM-DD → one Dhaka day of counter tickets with the money by payment method. A counter
 * sees its own sales; the manager everyone's, or one counter's with &staff=<id>.
 * ?phone=… → the last tickets for that number, to fill in a regular passenger's name.
 */
export async function GET(req: NextRequest) {
  try {
    const { db, user } = await seller()
    if (!user) return NextResponse.json({ error: 'Only the manager or a counter can see counter sales' }, { status: 403 })
    const params = req.nextUrl.searchParams
    const phone = params.get('phone')
    if (phone) {
      return NextResponse.json({ tickets: await ticketsForPhone(db, user.companyId, phone) }, { headers: NO_STORE })
    }
    const asked = params.get('day') || ''
    const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : dhakaDate()
    const staff = user.role === 'counter' ? user.staffId : params.get('staff') || undefined
    const report = await counterDay(db, user.companyId, day, staff)
    // The staff list lets the manager pick whose day to see.
    const staffList =
      user.role === 'manager'
        ? (await db.collection('staff').find({ companyId: user.companyId, role: 'counter' }).project({ name: 1 }).toArray()).map((s) => ({ id: s._id.toString(), name: String(s.name) }))
        : []
    return NextResponse.json({ ...report, staff: staffList, me: { role: user.role, name: user.name } }, { headers: NO_STORE })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load counter sales' }, { status: 500 })
  }
}
