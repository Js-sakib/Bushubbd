import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { readAccount } from '@/lib/payoutAccount'

export const dynamic = 'force-dynamic'

/**
 * The manager sets where BusHub sends the company's money. Changing it needs the company
 * password, every change is kept with the old details, and the admin sees when it last changed,
 * so nobody can quietly send the company's money somewhere else.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || user.role !== 'manager') return NextResponse.json({ error: 'Only the company manager can change this' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const account = readAccount(body)
    if ('error' in account) return NextResponse.json({ error: account.error }, { status: 400 })
    const company = await db.collection('companies').findOne({ _id: new ObjectId(user.companyId) })
    if (!company || !(await bcrypt.compare(String(body.password || ''), company.passwordHash))) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }
    const payoutAccount = { ...account, updatedAt: new Date().toISOString(), updatedBy: user.name }
    await db.collection('companies').updateOne(
      { _id: company._id },
      { $set: { payoutAccount }, ...(company.payoutAccount ? { $push: { payoutAccountHistory: company.payoutAccount } } : {}) } as any
    )
    return NextResponse.json({ account: payoutAccount })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
