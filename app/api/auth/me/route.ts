import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAdminFromCookies } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'

export const dynamic = 'force-dynamic'

/**
 * Who is signed in. One browser can hold both an admin and an operator login (the owner often
 * tests the operator panel on the phone they run the admin panel from), so each panel checks
 * its own field: `admin` for the admin panel, `company` for the operator panel. `role` still
 * says admin first. `company.role` says which operator page to open.
 */
export async function GET() {
  const admin = getAdminFromCookies()
  let company = null
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (user) {
      const owner = ObjectId.isValid(user.companyId)
        ? await db.collection('companies').findOne({ _id: new ObjectId(user.companyId) }, { projection: { name: 1 } })
        : null
      company = { ...user, companyName: owner?.name || '' }
    }
  } catch (err) {
    console.error(err)
  }
  return NextResponse.json({
    role: admin ? 'admin' : company ? 'company' : null,
    admin: Boolean(admin),
    company,
  })
}
