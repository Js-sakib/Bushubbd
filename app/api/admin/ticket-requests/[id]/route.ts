import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'sent', 'rejected']

/** Marks a lost-ticket request as sent (with the ticket that was sent) or rejected, or new again. Admin only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    const body = await req.json().catch(() => null)
    const status = String(body?.status || '')
    if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    const set: Record<string, unknown> = { status, handledAt: new Date().toISOString() }
    if (status === 'sent') {
      set.sentBookingCode = String(body?.bookingCode || '')
      set.sentBy = String(body?.via || '')
    }
    const { db } = await connectToDatabase()
    const result = await db.collection('ticketRequests').updateOne({ _id: new ObjectId(params.id) }, { $set: set })
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not update the request' }, { status: 500 })
  }
}
