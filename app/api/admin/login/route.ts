import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { LOGIN_NOT_CONFIGURED, sameSecret, signAdminToken } from '@/lib/auth'
import { clientIp, recordMiss, tooManyMisses } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/** Wrong admin passwords one connection may try in ten minutes. */
const ADMIN_MISS_LIMIT = 10

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Admin login is not configured yet' }, { status: 500 })
  }

  // Too many wrong tries from one place: wait, even with the right password, so guessing gets nowhere.
  const { db } = await connectToDatabase()
  const missKey = `login-admin:${clientIp(req.headers)}`
  if (await tooManyMisses(db, missKey, ADMIN_MISS_LIMIT)) {
    return NextResponse.json({ error: 'Too many wrong tries. Please wait 10 minutes.' }, { status: 429 })
  }

  const sameEmail = sameSecret(String(email || '').trim().toLowerCase(), adminEmail.trim().toLowerCase())
  const samePassword = sameSecret(String(password || ''), adminPassword)
  if (!sameEmail || !samePassword) {
    await recordMiss(db, missKey)
    return NextResponse.json({ error: 'Wrong Password or Email' }, { status: 401 })
  }

  const token = signAdminToken()
  if (!token) return NextResponse.json({ error: LOGIN_NOT_CONFIGURED }, { status: 500 })
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_token', '', { maxAge: 0, path: '/' })
  return res
}
