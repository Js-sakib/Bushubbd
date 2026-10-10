import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION } from '@/lib/auth'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'
import { BAD_CODE, cleanResetCode, passwordProblem, useResetCode } from '@/lib/passwordReset'

export const dynamic = 'force-dynamic'

/** Wrong codes one connection may type in ten minutes, across every account. */
const IP_LIMIT = 10

/**
 * The second step of "Forgot password": the operator types the 6-digit code they were sent and
 * a new password. Every wrong, old or used code gets the same answer. The code works once.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const address = String(body?.email || '').trim()
    const code = cleanResetCode(body?.code)
    if (!address) return NextResponse.json({ error: 'Please enter your email' }, { status: 400 })
    const problem = passwordProblem(body?.password)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    const { db } = await connectToDatabase()
    const missKey = `reset-code:${clientIp(req.headers)}`
    if (await tooManyMisses(db, missKey, IP_LIMIT)) {
      return NextResponse.json({ error: 'Too many tries. Please wait 10 minutes and try again.' }, { status: 429 })
    }

    const company = await db.collection('companies').findOne({ email: address }, { collation: EMAIL_COLLATION })
    if (!company || !code || !(await useResetCode(db, company._id, code))) {
      await recordMiss(db, missKey)
      return NextResponse.json({ error: BAD_CODE }, { status: 400 })
    }

    await db.collection('companies').updateOne(
      { _id: company._id },
      {
        $set: { passwordHash: await bcrypt.hash(body.password, 10), passwordResetAt: new Date().toISOString() },
        $unset: { passwordResetRequestedAt: '' },
      }
    )
    await db.collection('password_resets').deleteMany({ companyId: company._id })
    // Wrong passwords typed before the reset should not keep the owner locked out of the new one.
    await db.collection<{ _id: string }>('rate_limits').deleteMany({ _id: { $regex: `^login-company-email:${escapeRegex(String(company.email).toLowerCase())}\\|` } })

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not change your password, please try again' }, { status: 500 })
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
