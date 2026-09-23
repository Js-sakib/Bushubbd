import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION, signCompanyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const company = await db
      .collection('companies')
      .findOne({ email: String(email).trim() }, { collation: EMAIL_COLLATION })
    if (!company) {
      return NextResponse.json({ error: 'Wrong Password or Email' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, company.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Wrong Password or Email' }, { status: 401 })
    }

    if (company.status !== 'approved') {
      return NextResponse.json({ error: 'Your account is pending admin approval' }, { status: 403 })
    }

    const token = signCompanyToken({ companyId: company._id.toString(), email: company.email })
    const res = NextResponse.json({ success: true, company: { name: company.name, email: company.email } })
    res.cookies.set('company_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('company_token', '', { maxAge: 0, path: '/' })
  return res
}
