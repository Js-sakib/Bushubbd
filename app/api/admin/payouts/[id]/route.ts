import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { PAY_METHODS, invoiceSummary, releaseInvoice, type PayMethod } from '@/lib/payouts'
import { PAY_METHOD_LABELS } from '@/lib/payoutText'

export const dynamic = 'force-dynamic'

/** The payment details in a request, checked; or why they are wrong. */
function readPayment(body: any): { method: PayMethod; reference: string; note: string } | { error: string } {
  const method = String(body.method || '') as PayMethod
  const reference = String(body.reference || '').trim()
  const note = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!PAY_METHODS.includes(method)) return { error: 'Choose how it was paid' }
  if (method === 'cash') {
    // Cash has no transaction ID; the box can hold who took the money, or stay empty.
    if (reference && !/^[\p{L}\p{N}][\p{L}\p{N} .,'()/#-]{1,59}$/u.test(reference)) {
      return { error: 'Type the name of who received the cash (letters and numbers), or leave it empty' }
    }
  } else if (!/^[A-Za-z0-9][A-Za-z0-9 ./#-]{3,59}$/.test(reference)) {
    return { error: 'Type the payment reference (bKash TrxID, bank reference...): 4 to 60 letters or numbers' }
  }
  return { method, reference, note }
}

const describe = (p: { method: PayMethod; reference: string }) =>
  `${PAY_METHOD_LABELS[p.method] || p.method}${p.reference ? `, ${p.method === 'cash' ? 'received by' : 'ref'} ${p.reference}` : ''}`

/**
 * The admin's actions on an invoice:
 * - paid: record the payment (method and reference, e.g. the bKash TrxID; cash needs none).
 * - edit: correct a recorded payment. If the company had already signed, its signature no longer
 *   matches, so the invoice goes back to waiting for the company to sign again.
 * - unpay: take back a payment recorded by mistake, before the company has signed.
 * - cancel: cancel an invoice nobody has paid, freeing its tickets (and refunds) for the next one.
 * Every change is written in the invoice's history with what it was before.
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
    const log = (event: string) => ({ history: { at, by: 'BusHub admin', event } })

    if (body.action === 'paid') {
      const p = readPayment(body)
      if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 })
      const payment = { ...p, amount: invoice.totals.payout, at }
      const result = await db.collection('payouts').updateOne(
        { _id, status: { $in: ['unpaid', 'disputed'] } },
        { $set: { status: 'paid', payment }, $push: log(`Paid ${invoice.totals.payout} by ${describe(p)}`) } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: `This invoice is ${invoice.status}; it can't be paid again` }, { status: 409 })
    } else if (body.action === 'edit') {
      const p = readPayment(body)
      if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 })
      if (!invoice.payment || !['paid', 'disputed', 'confirmed'].includes(invoice.status)) {
        return NextResponse.json({ error: 'There is no payment on this invoice to change' }, { status: 409 })
      }
      const payment = { ...invoice.payment, ...p, editedAt: at }
      const signed = invoice.status === 'confirmed'
      const result = await db.collection('payouts').updateOne(
        { _id, status: invoice.status },
        {
          $set: { payment, ...(signed ? { status: 'paid' } : {}) },
          ...(signed ? { $unset: { confirmation: '' } } : {}),
          $push: log(`Payment changed from ${describe(invoice.payment)} to ${describe(p)}${signed ? '; the company must sign again' : ''}`),
        } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'This invoice just changed. Reload and try again.' }, { status: 409 })
    } else if (body.action === 'unpay') {
      const result = await db.collection('payouts').updateOne(
        { _id, status: { $in: ['paid', 'disputed'] } },
        { $set: { status: 'unpaid' }, $unset: { payment: '', dispute: '' }, $push: log(`Payment record removed (was ${invoice.payment ? describe(invoice.payment) : 'none'})`) } as any
      )
      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: 'Only a payment the company has not signed can be taken back' }, { status: 409 })
      }
    } else if (body.action === 'cancel') {
      const result = await db.collection('payouts').updateOne({ _id, status: 'unpaid' }, { $set: { status: 'cancelled' }, $push: log('Cancelled') } as any)
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'Only an invoice nobody has paid can be cancelled' }, { status: 409 })
      await releaseInvoice(db, params.id)
    } else {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    }
    return NextResponse.json({ invoice: invoiceSummary(await db.collection('payouts').findOne({ _id })) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to change the invoice' }, { status: 500 })
  }
}
