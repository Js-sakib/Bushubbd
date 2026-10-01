import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { temporaryPassword } from '@/lib/passwords'
import { getCompanyUser } from '@/lib/staff'

export const dynamic = 'force-dynamic'

/** Switch a staff login off or on, or give it a new password (shown once). Manager only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Only the company manager can change staff logins' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid login' }, { status: 400 })
    }
    const filter = { _id: new ObjectId(params.id), companyId: user.companyId }
    const body = await req.json().catch(() => ({}))

    if (body.status === 'active' || body.status === 'disabled') {
      const result = await db.collection('staff').updateOne(filter, { $set: { status: body.status } })
      if (result.matchedCount === 0) return NextResponse.json({ error: 'Login not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }
    if (body.resetPassword) {
      const password = temporaryPassword()
      const result = await db
        .collection('staff')
        .updateOne(filter, { $set: { passwordHash: await bcrypt.hash(password, 10), passwordResetAt: new Date().toISOString() } })
      if (result.matchedCount === 0) return NextResponse.json({ error: 'Login not found' }, { status: 404 })
      return NextResponse.json({ success: true, password })
    }
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to change the login' }, { status: 500 })
  }
}

/** Remove a staff login for good. Seats it sold stay sold, with its name on them. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Only the company manager can remove staff logins' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid login' }, { status: 400 })
    }
    const result = await db.collection('staff').deleteOne({ _id: new ObjectId(params.id), companyId: user.companyId })
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Login not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove the login' }, { status: 500 })
  }
}
