import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getCompanyFromCookies, getAdminFromCookies } from '@/lib/auth'
import { Bus } from '@/lib/models'
import { DEFAULT_COMMISSION_RATE } from '@/lib/tickets'

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
    return NextResponse.json({ buses })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const company = getCompanyFromCookies()
    const admin = getAdminFromCookies()
    if (!company && !admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { busName, busType, from, to, date, departureTime, arrivalTime, price, totalSeats, companyName, commissionRate } = body

    if (!busName || !from || !to || !date || !departureTime || !price || !totalSeats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const bus: Bus = {
      companyId: company ? company.companyId : 'admin',
      companyName: company ? company.email : companyName || 'BusHub',
      busName,
      busType: busType || 'AC',
      from,
      to,
      date,
      departureTime,
      arrivalTime: arrivalTime || '',
      price: Number(price),
      totalSeats: Number(totalSeats),
      bookedSeats: [],
      // Only the platform admin can set a custom commission rate; companies always get the default
      commissionRate: admin && commissionRate ? Number(commissionRate) : DEFAULT_COMMISSION_RATE,
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    const { db } = await connectToDatabase()
    const result = await db.collection('buses').insertOne(bus as any)
    return NextResponse.json({ bus: { ...bus, _id: result.insertedId } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create bus' }, { status: 500 })
  }
}
