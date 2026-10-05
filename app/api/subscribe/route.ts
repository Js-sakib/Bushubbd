import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { looksLikeEmail } from '@/lib/ticketLookup'

export const dynamic = 'force-dynamic'

/**
 * Signs an email up for offers and new routes. The admin sees the list on the dashboard.
 * Signing up twice is fine: the address is kept once.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = String(body?.email || '')
      .trim()
      .toLowerCase()
    if (!looksLikeEmail(email) || email.length > 120) {
      return NextResponse.json({ error: 'Please write a valid email address' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    await db
      .collection('subscribers')
      .updateOne({ email }, { $setOnInsert: { email, createdAt: new Date().toISOString() } }, { upsert: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not sign you up, please try again' }, { status: 500 })
  }
}
