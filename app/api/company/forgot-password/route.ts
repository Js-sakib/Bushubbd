import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION } from '@/lib/auth'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { createResetCode, resetCodesConfigured, sendResetCode } from '@/lib/passwordReset'

export const dynamic = 'force-dynamic'

/** One request is enough to put an operator at the top of the admin's list. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000
/** Code requests one connection may make in ten minutes, and requests for one email. */
const IP_LIMIT = 10
const EMAIL_LIMIT = 3

/**
 * An operator who forgot their password asks for a reset. When email or the WhatsApp code
 * template is set up, a 6-digit code goes to the account's email and WhatsApp (mode "code").
 * Otherwise, or when nothing could be sent, the request is flagged on the admin's Companies tab
 * and the BusHub team sends a new password by hand (mode "manual"). The reply is the same whether
 * or not the email is registered, so this form cannot be used to find out which companies have
 * accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(() => ({ email: '' }))
    const address = String(email || '').trim()
    if (!address) {
      return NextResponse.json({ error: 'Please enter your email' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const mode = resetCodesConfigured() ? 'code' : 'manual'
    const ipKey = `reset-ip:${clientIp(req.headers)}`
    const emailKey = `reset-email:${address.toLowerCase()}`
    if (mode === 'code') {
      if ((await tooManyMisses(db, ipKey, IP_LIMIT)) || (await tooManyMisses(db, emailKey, EMAIL_LIMIT))) {
        return NextResponse.json({ error: 'Too many requests. Please wait 10 minutes and try again.' }, { status: 429 })
      }
      await Promise.all([recordMiss(db, ipKey), recordMiss(db, emailKey)])
    }

    const company = await db.collection('companies').findOne({ email: address }, { collation: EMAIL_COLLATION })
    let sent = false
    if (company && mode === 'code') {
      const code = await createResetCode(db, company._id)
      sent = await sendResetCode({ email: company.email, phone: company.phone, ownerName: company.ownerName, name: company.name }, code)
    }
    // Nothing reached them: the BusHub team picks it up from the admin's list instead.
    if (company && !sent) {
      const cutoff = new Date(Date.now() - REPEAT_WINDOW_MS)
      await db.collection('companies').updateOne(
        { _id: company._id, $or: [{ passwordResetRequestedAt: { $exists: false } }, { passwordResetRequestedAt: { $lt: cutoff } }] },
        { $set: { passwordResetRequestedAt: new Date() } }
      )
    }

    return NextResponse.json({ success: true, mode })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not send your request, please try again' }, { status: 500 })
  }
}
