import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Hides a review from the home page, or shows it again. Admin only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    const body = await req.json().catch(() => null)
    if (typeof body?.hidden !== 'boolean') return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    const { db } = await connectToDatabase()
    const result = await db.collection('reviews').updateOne({ _id: new ObjectId(params.id) }, { $set: { hidden: body.hidden } })
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not change the review' }, { status: 500 })
  }
}

/** Deletes a review for good. Admin only. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    const { db } = await connectToDatabase()
    const result = await db.collection('reviews').deleteOne({ _id: new ObjectId(params.id) })
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not delete the review' }, { status: 500 })
  }
}
