import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION, signCompanyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
}

/**
 * One sign-in for everyone at a bus company. The company's own email opens Management; the
 * counter and scanner logins its manager created open their own pages.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const typed = String(email).trim()

    const { db } = await connectToDatabase()
    const company = await db.collection('companies').findOne({ email: typed }, { collation: EMAIL_COLLATION })
    if (company) {
      const valid = await bcrypt.compare(password, company.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Wrong Password or Email' }, { status: 401 })
      }
      if (company.status !== 'approved') {
        return NextResponse.json({ error: 'Your account is pending admin approval' }, { status: 403 })
      }
      const token = signCompanyToken({ companyId: company._id.toString(), email: company.email, staffRole: 'manager', name: company.name })
      const res = NextResponse.json({ success: true, role: 'manager', company: { name: company.name, email: company.email } })
      res.cookies.set('company_token', token, COOKIE)
      return res
    }

    const staff = await db.collection('staff').findOne({ email: typed }, { collation: EMAIL_COLLATION })
    if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
      return NextResponse.json({ error: 'Wrong Password or Email' }, { status: 401 })
    }
    if (staff.status !== 'active') {
      return NextResponse.json({ error: 'This login has been switched off. Ask your manager.' }, { status: 403 })
    }
    const owner = ObjectId.isValid(staff.companyId)
      ? await db.collection('companies').findOne({ _id: new ObjectId(staff.companyId) }, { projection: { status: 1, name: 1 } })
      : null
    if (!owner || owner.status !== 'approved') {
      return NextResponse.json({ error: 'Your company is not active on BusHub right now' }, { status: 403 })
    }
    const token = signCompanyToken({
      companyId: staff.companyId,
      email: staff.email,
      staffRole: staff.role,
      staffId: staff._id.toString(),
      name: staff.name,
    })
    const res = NextResponse.json({ success: true, role: staff.role, company: { name: owner.name, email: staff.email } })
    res.cookies.set('company_token', token, COOKIE)
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
