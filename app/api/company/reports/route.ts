import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { buildReport, reportRange } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** The manager's own company for ?from=&to= (Dhaka dates; the last 30 days by default), against the period before. */
export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'manager') return NextResponse.json({ error: 'Only the manager can see reports' }, { status: 403 })
    const range = reportRange(req.nextUrl.searchParams.get('from'), req.nextUrl.searchParams.get('to'))
    if (!range) return NextResponse.json({ error: 'Choose a start date on or before the end date' }, { status: 400 })
    return NextResponse.json(await buildReport(db, range, user.companyId), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Company report error:', error)
    return NextResponse.json({ error: 'Could not make the report' }, { status: 500 })
  }
}
