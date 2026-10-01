import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { changeCounterSeats } from '@/lib/counterSeats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can change seats' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bus id' }, { status: 400 })
    }

    const { seats, action } = await req.json()
    if (!Array.isArray(seats) || seats.length === 0 || !['block', 'unblock'].includes(action)) {
      return NextResponse.json(
        { error: 'Provide seats (array) and action ("block" or "unblock")' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const result = await changeCounterSeats(db, params.id, seats, action === 'block' ? 'sell' : 'unsell', { kind: 'admin' })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 })
  }
}
