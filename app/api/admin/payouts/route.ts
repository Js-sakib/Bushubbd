import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { createInvoice, invoiceSummary, openDeductions, owedLines, totalsOf, upcomingTotals } from '@/lib/payouts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

/** What BusHub owes each company right now, what it will owe once trips leave, and every invoice. */
export async function GET() {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { db } = await connectToDatabase()
    const companies = await db.collection('companies').find({}).project({ name: 1, status: 1, payoutAccount: 1 }).sort({ name: 1 }).toArray()
    const rows = await Promise.all(
      companies.map(async (c) => {
        const id = c._id.toString()
        const [owed, later, refunds] = await Promise.all([owedLines(db, id), upcomingTotals(db, id), openDeductions(db, id)])
        return {
          _id: id,
          name: String(c.name),
          status: c.status,
          owed: totalsOf(owed),
          later,
          refunds: refunds.reduce((n, d) => n + d.amount, 0),
          account: c.payoutAccount || null,
        }
      })
    )
    const invoices = await db.collection('payouts').find({}).project({ lines: 0 }).sort({ createdAt: -1 }).limit(300).toArray()
    const unpaid = await db.collection('payouts').find({ status: { $in: ['unpaid', 'disputed'] } }).project({ companyId: 1, totals: 1 }).toArray()
    const withInvoiced = rows.map((r) => ({
      ...r,
      invoiced: unpaid.filter((i) => i.companyId === r._id).reduce((n, i) => n + i.totals.payout, 0),
    }))
    return NextResponse.json({ companies: withInvoiced, invoices: invoices.map(invoiceSummary) }, { headers: NO_STORE })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load payouts' }, { status: 500 })
  }
}

/** Make an invoice of everything owed to one company now, or for one trip (`tripId`). */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { companyId, tripId } = await req.json().catch(() => ({}))
    if (tripId !== undefined && !ObjectId.isValid(String(tripId))) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (!ObjectId.isValid(String(companyId || ''))) return NextResponse.json({ error: 'Choose a company' }, { status: 400 })
    const { db } = await connectToDatabase()
    const company = await db.collection('companies').findOne({ _id: new ObjectId(String(companyId)) })
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    const invoice = await createInvoice(db, company._id.toString(), String(company.name), tripId ? String(tripId) : undefined)
    if (!invoice) {
      return NextResponse.json(
        { error: tripId ? 'Nothing to pay for this trip: it has not left yet, or it is already invoiced' : 'Nothing is owed to this company right now' },
        { status: 409 }
      )
    }
    return NextResponse.json({ invoice: invoiceSummary(invoice) }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to make the invoice' }, { status: 500 })
  }
}
