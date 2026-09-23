import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// No 0/O, 1/l/I: the password is read out over the phone or copied from WhatsApp.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function temporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `${group()}-${group()}-${group()}`
}

/**
 * Operators have no self-service reset: they contact the BusHub team, and the admin issues a
 * new password here. It is returned once and never stored in readable form.
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

    const password = temporaryPassword()
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
