import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = getCompanyFromCookies()
    const admin = getAdminFromCookies()
    if (!company && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }

    const { seats, action } = await req.json()
    if (!Array.isArray(seats) || seats.length === 0 || !['book', 'release'].includes(action)) {
      return NextResponse.json({ error: 'Provide seats (array) and action ("book" or "release")' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }
    if (company && bus.companyId !== company.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'book') {
      await db.collection('buses').updateOne(
        { _id: new ObjectId(params.id) },
        { $addToSet: { bookedSeats: { $each: seats } } } as any
      )
    } else {
      await db.collection('buses').updateOne(
        { _id: new ObjectId(params.id) },
        { $pull: { bookedSeats: { $in: seats } } } as any
      )
    }

    const updated = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    return NextResponse.json({ bus: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 })
  }
}
