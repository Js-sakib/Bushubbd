import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { Bus } from '@/lib/models'
import { DEFAULT_COMMISSION_RATE } from '@/lib/tickets'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')
    const companyId = searchParams.get('companyId')

    const query: Record<string, any> = { status: 'active' }
    if (from) query.from = from
    if (to) query.to = to
    if (date) query.date = date
    if (companyId) query.companyId = companyId

    const buses = await db.collection('buses').find(query).sort({ departureTime: 1 }).toArray()
    return NextResponse.json({ buses }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Operators send their schedules to the BusHub team; only the admin lists buses.
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can add buses' }, { status: 403 })
    }

    const body = await req.json()
    const { busName, busType, from, to, date, departureTime, arrivalTime, price, totalSeats, companyId, companyName, commissionRate, logoUrl } = body

    if (!busName || !from || !to || !date || !departureTime || !price || !totalSeats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { db } = await connectToDatabase()

    // A bus tied to an operator account is what lets that operator scan its tickets.
    let owner = { id: 'admin', name: (companyName || 'BusHub').trim() }
    if (companyId) {
      const company = ObjectId.isValid(companyId)
        ? await db.collection('companies').findOne({ _id: new ObjectId(companyId) })
        : null
      if (!company) {
        return NextResponse.json({ error: 'That bus company was not found' }, { status: 400 })
      }
      owner = { id: company._id.toString(), name: company.name }
    }

    const bus: Bus = {
      companyId: owner.id,
      companyName: owner.name,
      busName,
      busType: busType || 'AC',
      logoUrl: typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : undefined,
      from,
      to,
      date,
      departureTime,
      arrivalTime: arrivalTime || '',
      price: Number(price),
      totalSeats: Number(totalSeats),
      bookedSeats: [],
      blockedSeats: [],
      commissionRate: commissionRate ? Number(commissionRate) : DEFAULT_COMMISSION_RATE,
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    const result = await db.collection('buses').insertOne(bus as any)
    return NextResponse.json({ bus: { ...bus, _id: result.insertedId } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create bus' }, { status: 500 })
  }
}
