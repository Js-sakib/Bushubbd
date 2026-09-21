import { NextResponse } from 'next/server'
import { getAdminFromCookies, getCompanyFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = getAdminFromCookies()
  if (admin) {
    return NextResponse.json({ role: 'admin' })
  }
  const company = getCompanyFromCookies()
  if (company) {
    return NextResponse.json({ role: 'company', email: company.email, companyId: company.companyId })
  }
  return NextResponse.json({ role: null }, { status: 200 })
}
