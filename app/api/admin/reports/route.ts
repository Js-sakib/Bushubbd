import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { buildReport, reportRange } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** All of BusHub for ?from=&to= (Dhaka dates; the last 30 days by default), against the period before. Admin only. */
export async function GET(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const range = reportRange(req.nextUrl.searchParams.get('from'), req.nextUrl.searchParams.get('to'))
    if (!range) return NextResponse.json({ error: 'Choose a start date on or before the end date' }, { status: 400 })
    const { db } = await connectToDatabase()
    return NextResponse.json(await buildReport(db, range), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Admin report error:', error)
    return NextResponse.json({ error: 'Could not make the report' }, { status: 500 })
  }
}
