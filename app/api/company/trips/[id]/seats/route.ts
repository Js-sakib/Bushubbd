import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { changeCounterSeats } from '@/lib/counterSeats'
import { getCompanyUser } from '@/lib/staff'

export const dynamic = 'force-dynamic'

/** A counter (or the manager) marks seats sold at the counter, or undoes it. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'manager' && user.role !== 'counter')) {
      return NextResponse.json({ error: 'Only the manager or a counter can sell seats' }, { status: 403 })
    }
    const { seats, action } = await req.json().catch(() => ({}))
    if (action !== 'sell' && action !== 'unsell') {
      return NextResponse.json({ error: 'Say whether to sell or unsell' }, { status: 400 })
    }
    const result = await changeCounterSeats(db, params.id, seats, action, {
      kind: 'company',
      companyId: user.companyId,
      role: user.role,
      staffId: user.staffId,
      name: user.name,
    })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 })
  }
}
