import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { PAY_METHODS, invoiceSummary, type PayMethod } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

/**
 * The admin records the payment of an invoice (method and reference, e.g. the bKash TrxID), or
 * cancels an invoice nobody has paid yet, which frees its tickets for the next one. A paid
 * invoice can't be cancelled, and a signed one can't be changed at all.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const { db } = await connectToDatabase()
    const _id = new ObjectId(params.id)
    const invoice = await db.collection('payouts').findOne({ _id })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const at = new Date().toISOString()

    if (body.action === 'paid') {
      const method = String(body.method || '') as PayMethod
      const reference = String(body.reference || '').trim()
      const note = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      if (!PAY_METHODS.includes(method)) return NextResponse.json({ error: 'Choose how it was paid' }, { status: 400 })
      if (!/^[A-Za-z0-9][A-Za-z0-9 ./#-]{3,59}$/.test(reference)) {
        return NextResponse.json({ error: 'Type the payment reference (bKash TrxID, bank reference...): 4 to 60 letters or numbers' }, { status: 400 })
      }
      const payment = { method, reference, note, amount: invoice.totals.payout, at }
      const result = await db.collection('payouts').updateOne(
        { _id, status: { $in: ['unpaid', 'disputed'] } },
        { $set: { status: 'paid', payment }, $push: { history: { at, by: 'BusHub admin', event: `Paid ${invoice.totals.payout} by ${method}, ref ${reference}` } } } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: `This invoice is ${invoice.status}; it can't be paid again` }, { status: 409 })
    } else if (body.action === 'cancel') {
      const result = await db.collection('payouts').updateOne(
        { _id, status: 'unpaid' },
        { $set: { status: 'cancelled' }, $push: { history: { at, by: 'BusHub admin', event: 'Cancelled' } } } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'Only an invoice nobody has paid can be cancelled' }, { status: 409 })
      await db.collection('bookings').updateMany({ payoutId: params.id }, { $unset: { payoutId: '' } })
    } else {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    }
    return NextResponse.json({ invoice: invoiceSummary(await db.collection('payouts').findOne({ _id })) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to change the invoice' }, { status: 500 })
  }
}
