import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/db'
import { EMAIL_COLLATION, getAdminFromCookies } from '@/lib/auth'
import { findCompanyByName } from '@/lib/companies'
import { Company } from '@/lib/models'
import { cleanName } from '@/lib/names'
import { temporaryPassword } from '@/lib/passwords'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = getAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { db } = await connectToDatabase()
  const companies = await db
    .collection('companies')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray()
  return NextResponse.json({ companies })
}

/**
 * The admin adds a bus company directly, already approved, with a generated password that is
 * shown once to pass on. Each company name and email can be used only once.
 */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const name = cleanName(body.name)
    const ownerName = cleanName(body.ownerName)
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').trim()

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'Enter the company name' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email for their login' }, { status: 400 })
    }
    if (!ownerName || !phone) {
      return NextResponse.json({ error: 'Enter the contact person and phone' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const sameName = await findCompanyByName(db, name)
    if (sameName) {
      return NextResponse.json({ error: `"${sameName.name}" is already a BusHub company` }, { status: 409 })
    }
    const sameEmail = await db.collection('companies').findOne({ email }, { collation: EMAIL_COLLATION })
    if (sameEmail) {
      return NextResponse.json({ error: `That email already belongs to ${sameEmail.name}` }, { status: 409 })
    }

    const password = temporaryPassword()
    const company: Company = {
      name,
      ownerName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'approved',
      createdAt: new Date().toISOString(),
    }
    const result = await db.collection('companies').insertOne({ ...company } as any)
    const { passwordHash: _hash, ...safe } = company
    return NextResponse.json({ company: { ...safe, _id: result.insertedId }, password }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add the company' }, { status: 500 })
  }
}
