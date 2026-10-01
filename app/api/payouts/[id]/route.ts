import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { getCompanyUser } from '@/lib/staff'
import { invoiceFull } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

/** One whole invoice with every ticket: for the BusHub admin, or that company's manager. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const { db } = await connectToDatabase()
    // Someone signed in to both panels on one phone says which one this page is for (?as=admin).
    const asAdmin = new URL(req.url).searchParams.get('as') === 'admin'
    const user = asAdmin ? null : await getCompanyUser(db)
    const admin = !user && Boolean(getAdminFromCookies())
    if (!admin && user?.role !== 'manager') return NextResponse.json({ error: 'Please log in' }, { status: 401 })
    const invoice = await db.collection('payouts').findOne({ _id: new ObjectId(params.id), ...(admin ? {} : { companyId: user!.companyId }) })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const { signFails, signLockedUntil, ...rest } = invoice as any
    return NextResponse.json({ invoice: invoiceFull(rest), viewer: admin ? 'admin' : 'company' }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load the invoice' }, { status: 500 })
  }
}
