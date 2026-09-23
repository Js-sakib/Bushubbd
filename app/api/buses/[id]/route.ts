import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { releaseExpiredHolds } from '@/lib/seatHold'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    await releaseExpiredHolds(db, params.id)
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }
    return NextResponse.json({ bus }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch bus' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }

    const body = await req.json()
    const allowedFields = ['busName', 'busType', 'from', 'to', 'date', 'departureTime', 'arrivalTime', 'price', 'totalSeats', 'status', 'commissionRate']
    const update: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    const { db } = await connectToDatabase()

    // Linking a bus to an operator account is what lets that operator scan its tickets.
    // The name follows the account, so tickets and payouts carry the registered name.
    if (body.companyId !== undefined) {
      const company = ObjectId.isValid(body.companyId)
        ? await db.collection('companies').findOne({ _id: new ObjectId(body.companyId), status: 'approved' })
        : null
      if (!company) {
        return NextResponse.json({ error: 'Choose an approved bus company' }, { status: 400 })
      }
      update.companyId = company._id.toString()
      update.companyName = company.name
      await db
        .collection('bookings')
        .updateMany({ busId: params.id }, { $set: { companyName: company.name } })
    }

    await db.collection('buses').updateOne({ _id: new ObjectId(params.id) }, { $set: update })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update bus' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change buses' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    await db.collection('buses').deleteOne({ _id: new ObjectId(params.id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete bus' }, { status: 500 })
  }
}
