import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** Every review, hidden ones too, and the emails signed up for offers. Admin only. */
export async function GET() {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { db } = await connectToDatabase()
    const [reviews, subscribers] = await Promise.all([
      db.collection('reviews').find({}).sort({ createdAt: -1 }).limit(500).toArray(),
      db.collection('subscribers').find({}).sort({ createdAt: -1 }).limit(5000).toArray(),
    ])
    return NextResponse.json({ reviews, subscribers })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 })
  }
}
