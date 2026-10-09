import { ObjectId, type Db } from 'mongodb'
import { EMAIL_COLLATION, companyRole, getCompanyFromCookies, type StaffRole } from './auth'

export interface CompanyUser {
  companyId: string
  email: string
  role: StaffRole
  /** Set for counter and scanner logins; the manager is the company login itself. */
  staffId?: string
  name: string
}

/**
 * The signed-in bus company user, checked against the database: a staff login the manager has
 * switched off stops working straight away, not when its cookie runs out.
 */
export async function getCompanyUser(db: Db): Promise<CompanyUser | null> {
  const token = getCompanyFromCookies()
  if (!token) return null
  // A company the admin suspended is logged out at once, not when its 7-day login runs out.
  if (!ObjectId.isValid(token.companyId)) return null
  const company = await db.collection('companies').findOne({ _id: new ObjectId(token.companyId) }, { projection: { status: 1 } })
  if (!company || company.status !== 'approved') return null
  if (!token.staffId) {
    return { companyId: token.companyId, email: token.email, role: companyRole(token), name: token.name || token.email }
  }
  if (!ObjectId.isValid(token.staffId)) return null
  const staff = await db.collection('staff').findOne({ _id: new ObjectId(token.staffId), companyId: token.companyId })
  if (!staff || staff.status !== 'active') return null
  return { companyId: token.companyId, email: staff.email, role: staff.role, staffId: token.staffId, name: staff.name }
}

/** True when no company or staff login already uses this email, whatever its capitals. */
export async function emailIsFree(db: Db, email: string): Promise<boolean> {
  const [company, staff] = await Promise.all([
    db.collection('companies').findOne({ email }, { collation: EMAIL_COLLATION, projection: { _id: 1 } }),
    db.collection('staff').findOne({ email }, { collation: EMAIL_COLLATION, projection: { _id: 1 } }),
  ])
  return !company && !staff
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Management',
  counter: 'Counter',
  scanner: 'Scanner',
}
