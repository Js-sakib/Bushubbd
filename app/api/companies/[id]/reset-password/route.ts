import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { temporaryPassword } from '@/lib/passwords'

export const dynamic = 'force-dynamic'

const MIN_LENGTH = 8
/** bcrypt ignores everything past 72 bytes, so a longer password would not mean what it says. */
const MAX_LENGTH = 72

/**
 * Operators have no self-service reset: they contact the BusHub team, and the admin sets a
 * new password here, either typed or generated. It is returned once and never stored in
 * readable form.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid company id' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const company = await db.collection('companies').findOne({ _id: new ObjectId(params.id) })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const typed = typeof body?.password === 'string' ? body.password : ''
    if (typed) {
      if (typed.trim().length < MIN_LENGTH) {
        return NextResponse.json({ error: `The password needs at least ${MIN_LENGTH} characters` }, { status: 400 })
      }
      if (Buffer.byteLength(typed, 'utf8') > MAX_LENGTH) {
        return NextResponse.json({ error: 'That password is too long' }, { status: 400 })
      }
    }
    const password = typed || temporaryPassword()
    await db
      .collection('companies')
      .updateOne(
        { _id: company._id },
        {
          $set: { passwordHash: await bcrypt.hash(password, 10), passwordResetAt: new Date().toISOString() },
          $unset: { passwordResetRequestedAt: '' },
        }
      )

    return NextResponse.json(
      { email: company.email, name: company.name, phone: company.phone, password },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not reset the password' }, { status: 500 })
  }
}
