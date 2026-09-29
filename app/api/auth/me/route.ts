import { NextResponse } from 'next/server'
import { getAdminFromCookies, getCompanyFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Who is signed in. One browser can hold both an admin and an operator login (the owner often
 * tests the operator panel on the phone they run the admin panel from), so each panel checks
 * its own field: `admin` for the admin panel, `company` for the operator panel. `role` still
 * says admin first.
 */
export async function GET() {
  const admin = getAdminFromCookies()
  const company = getCompanyFromCookies()
  return NextResponse.json({
    role: admin ? 'admin' : company ? 'company' : null,
    admin: Boolean(admin),
    company: company ? { email: company.email, companyId: company.companyId } : null,
  })
}
