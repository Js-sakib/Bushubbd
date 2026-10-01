import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { cleanName } from '@/lib/names'
import { temporaryPassword } from '@/lib/passwords'
import { emailIsFree, getCompanyUser } from '@/lib/staff'
import type { Staff } from '@/lib/models'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

/** The counter and scanner logins of the manager's company. Passwords are never sent back. */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Only the company manager can see staff logins' }, { status: 403 })
    }
    const staff = await db
      .collection('staff')
      .find({ companyId: user.companyId }, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray()
    return NextResponse.json({ staff }, { headers: NO_STORE })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 })
  }
}

/**
 * The manager adds a counter or scanner login. A password the manager types is used as it is;
 * otherwise one is made up. Either way it is shown once, to pass on to the staff member.
 */
export async function POST(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Only the company manager can add staff logins' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const name = cleanName(body.name)
    const email = String(body.email || '').trim()
    const role = body.role === 'counter' || body.role === 'scanner' ? body.role : null
    const typed = typeof body.password === 'string' ? body.password : ''

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'Give a name (2 to 60 letters), e.g. "Dampara counter"' }, { status: 400 })
    }
    if (!EMAIL.test(email) || email.length > 120) {
      return NextResponse.json({ error: 'Enter a valid email for this login' }, { status: 400 })
    }
    if (!role) {
      return NextResponse.json({ error: 'Choose Counter or Scanner' }, { status: 400 })
    }
    if (typed && (typed.length < MIN_PASSWORD || typed.length > 72)) {
      return NextResponse.json({ error: `The password needs at least ${MIN_PASSWORD} characters` }, { status: 400 })
    }
    if (!(await emailIsFree(db, email))) {
      return NextResponse.json({ error: 'That email already has a BusHub login' }, { status: 409 })
    }

    const company = await db.collection('companies').findOne({ _id: new ObjectId(user.companyId) }, { projection: { name: 1 } })
    const password = typed || temporaryPassword()
    const staff: Staff = {
      companyId: user.companyId,
      companyName: company?.name || '',
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    try {
      const result = await db.collection('staff').insertOne({ ...staff } as any)
      const { passwordHash: _hidden, ...shown } = staff
      return NextResponse.json({ staff: { ...shown, _id: result.insertedId }, password }, { status: 201 })
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      return NextResponse.json({ error: 'That email already has a BusHub login' }, { status: 409 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add the login' }, { status: 500 })
  }
}
