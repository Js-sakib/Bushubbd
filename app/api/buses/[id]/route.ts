import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    const bus = await db.collection('buses').findOne({ _id: new ObjectId(params.id) })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }
    return NextResponse.json({ bus })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch bus' }, { status: 500 })
  }
}

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

    const body = await req.json()
    const allowedFields = ['busName', 'busType', 'from', 'to', 'date', 'departureTime', 'arrivalTime', 'price', 'totalSeats', 'status']
    const update: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    const { db } = await connectToDatabase()
    await db.collection('buses').updateOne({ _id: new ObjectId(params.id) }, { $set: update })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update bus' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const company = getCompanyFromCookies()
    const admin = getAdminFromCookies()
    if (!company && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
