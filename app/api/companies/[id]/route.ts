import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
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

  const { status } = await req.json()
  if (!['pending', 'approved', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { db } = await connectToDatabase()
  await db.collection('companies').updateOne({ _id: new ObjectId(params.id) }, { $set: { status } })
  return NextResponse.json({ success: true })
}
