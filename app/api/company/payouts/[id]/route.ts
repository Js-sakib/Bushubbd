import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { checkInvoice, invoiceSummary, signOff } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

/** Wrong passwords allowed on one invoice before signing waits a while. */
const MAX_TRIES = 5
const WAIT_MINUTES = 15

/**
 * The company manager's steps on an invoice: approve its tickets and amounts before BusHub pays,
 * report a problem (before or after payment), and once paid sign it off ("Done: money received")
 * with their name and the company password. Only the manager, only their own invoice.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') return NextResponse.json({ error: 'Only the company manager can sign payments' }, { status: 403 })
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const _id = new ObjectId(params.id)
    const invoice = await db.collection('payouts').findOne({ _id, companyId: user.companyId })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const at = new Date().toISOString()

    if (body.action === 'confirm') {
      if (invoice.status !== 'paid') return NextResponse.json({ error: 'BusHub has not recorded a payment for this invoice yet' }, { status: 409 })
      if (invoice.signLockedUntil && invoice.signLockedUntil > at) {
        return NextResponse.json({ error: `Too many wrong passwords. Try again after ${WAIT_MINUTES} minutes.` }, { status: 429 })
      }
      const signedBy = String(body.signedBy || '').replace(/\s+/g, ' ').trim()
      if (signedBy.length < 3 || signedBy.length > 60) return NextResponse.json({ error: 'Type your full name to sign' }, { status: 400 })
      const company = await db.collection('companies').findOne({ _id: new ObjectId(user.companyId) })
      if (!company || !(await bcrypt.compare(String(body.password || ''), company.passwordHash))) {
        const tries = (invoice.signFails || 0) + 1
        await db.collection('payouts').updateOne(
          { _id },
          tries >= MAX_TRIES
            ? { $set: { signFails: 0, signLockedUntil: new Date(Date.now() + WAIT_MINUTES * 60000).toISOString() } }
            : { $set: { signFails: tries } }
        )
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }
      if (!checkInvoice(invoice).contentOk) {
        return NextResponse.json({ error: 'This invoice does not match its record. Contact BusHub before signing.' }, { status: 409 })
      }
      const confirmation = {
        signedBy,
        email: user.email,
        at,
        signature: signOff(invoice.contentHash, invoice.payment, signedBy, at),
      }
      const result = await db.collection('payouts').updateOne(
        { _id, status: 'paid' },
        { $set: { status: 'confirmed', confirmation, signFails: 0 }, $push: { history: { at, by: signedBy, event: 'Received and signed by the company' } } } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'This invoice changed. Reload and try again.' }, { status: 409 })
    } else if (body.action === 'approve') {
      // The company checked the tickets and amounts before BusHub pays.
      const result = await db.collection('payouts').updateOne(
        { _id, status: 'unpaid', approval: { $exists: false } },
        { $set: { approval: { by: user.name, at } }, $push: { history: { at, by: user.name, event: 'Tickets and amounts approved by the company' } } } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'This invoice is already approved or paid' }, { status: 409 })
    } else if (body.action === 'dispute') {
      const note = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, 300)
      if (note.length < 5) return NextResponse.json({ error: 'Write what is wrong' }, { status: 400 })
      const result = await db.collection('payouts').updateOne(
        { _id, status: { $in: ['unpaid', 'paid'] } },
        { $set: { status: 'disputed', dispute: { note, by: user.name, at } }, $push: { history: { at, by: user.name, event: `Problem reported: ${note}` } } } as any
      )
      if (result.modifiedCount === 0) return NextResponse.json({ error: 'This invoice can no longer be questioned' }, { status: 409 })
    } else {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    }
    return NextResponse.json({ invoice: invoiceSummary(await db.collection('payouts').findOne({ _id })) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update the invoice' }, { status: 500 })
  }
}
