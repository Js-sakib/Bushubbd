import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { cancelCounterTicket } from '@/lib/counterTickets'

export const dynamic = 'force-dynamic'

/** One counter ticket of this company, for a reprint. */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'manager' && user.role !== 'counter')) {
      return NextResponse.json({ error: 'Only the manager or a counter can see counter tickets' }, { status: 403 })
    }
    const ticket = await db.collection('counterTickets').findOne({ ticketCode: params.code, companyId: user.companyId })
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({ ticket }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load the ticket' }, { status: 500 })
  }
}

/** Cancel a counter ticket ({action:'cancel', reason}): the seats go back on sale, the ticket stays on record. */
export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'manager' && user.role !== 'counter')) {
      return NextResponse.json({ error: 'Only the manager or a counter can cancel tickets' }, { status: 403 })
    }
    const { action, reason } = await req.json().catch(() => ({}))
    if (action !== 'cancel') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    const result = await cancelCounterTicket(db, params.code, reason, {
      kind: 'company',
      companyId: user.companyId,
      role: user.role as 'manager' | 'counter',
      staffId: user.staffId,
      name: user.name,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ticket: result.value })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not cancel the ticket' }, { status: 500 })
  }
}
