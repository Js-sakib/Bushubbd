import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** One request is enough to put an operator at the top of the admin's list. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000

/**
 * An operator who forgot their password asks for a new one. There is no email service yet,
 * so the request is flagged on the admin's Companies tab and the BusHub team sends a new
 * password over WhatsApp. The reply is the same whether or not the email is registered,
 * so this form cannot be used to find out which companies have accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(() => ({ email: '' }))
    const address = String(email || '').trim()
    if (!address) {
      return NextResponse.json({ error: 'Please enter your email' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const cutoff = new Date(Date.now() - REPEAT_WINDOW_MS)
    await db.collection('companies').updateOne(
      {
        email: address,
        $or: [{ passwordResetRequestedAt: { $exists: false } }, { passwordResetRequestedAt: { $lt: cutoff } }],
      },
      { $set: { passwordResetRequestedAt: new Date() } },
      { collation: EMAIL_COLLATION }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not send your request, please try again' }, { status: 500 })
  }
}
