import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { invoiceSummary, owedLines, totalsOf, upcomingTotals } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

/** The manager's payments page: what BusHub owes now, what it will owe, and every invoice. */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') return NextResponse.json({ error: 'Only the company manager sees payments' }, { status: 403 })
    const [owed, later, invoices] = await Promise.all([
      owedLines(db, user.companyId),
      upcomingTotals(db, user.companyId),
      db.collection('payouts').find({ companyId: user.companyId, status: { $ne: 'cancelled' } }).project({ lines: 0 }).sort({ createdAt: -1 }).toArray(),
    ])
    return NextResponse.json(
      {
        owed: totalsOf(owed),
        later,
        // Invoices made but not paid yet are still owed.
        invoiced: invoices.filter((i) => i.status === 'unpaid' || i.status === 'disputed').reduce((n, i) => n + i.totals.payout, 0),
        invoices: invoices.map(invoiceSummary),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
  }
}
