import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { parseRate, setCompanyRate } from '@/lib/commission'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  if (body.commissionRate !== undefined) {
    const rate = parseRate(body.commissionRate)
    if (rate === null) return NextResponse.json({ error: 'Commission must be a number from 0 to 50 (%)' }, { status: 400 })
    const { db } = await connectToDatabase()
    if (!(await setCompanyRate(db, params.id, rate, 'BusHub admin'))) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    return NextResponse.json({ success: true, commissionRate: rate })
  }
  const { status } = body
  if (!['pending', 'approved', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { db } = await connectToDatabase()
  await db.collection('companies').updateOne({ _id: new ObjectId(params.id) }, { $set: { status } })
  return NextResponse.json({ success: true })
}
