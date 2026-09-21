import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

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
