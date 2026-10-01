import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

/**
 * Emails match whatever their capitalisation: phone keyboards often capitalise the first
 * letter, which used to make a correct password look wrong.
 */
export const EMAIL_COLLATION = { locale: 'en', strength: 2 } as const

/**
 * What a bus company login may do. The company's own login is the manager; the manager adds
 * counter staff (sell seats, add trips) and scanner staff (board passengers).
 */
export type StaffRole = 'manager' | 'counter' | 'scanner'

export interface CompanyTokenPayload {
  companyId: string
  email: string
  role: 'company'
  /** Missing on logins from before staff existed: those are the company's own, the manager. */
  staffRole?: StaffRole
  staffId?: string
  name?: string
}

export function companyRole(token: Pick<CompanyTokenPayload, 'staffRole'>): StaffRole {
  return token.staffRole ?? 'manager'
}

export interface AdminTokenPayload {
  role: 'admin'
}

export function signCompanyToken(payload: Omit<CompanyTokenPayload, 'role'>): string {
  return jwt.sign({ ...payload, role: 'company' }, JWT_SECRET, { expiresIn: '7d' })
}

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
}

export function getCompanyFromCookies(): CompanyTokenPayload | null {
  try {
    const token = cookies().get('company_token')?.value
    if (!token) return null
    const decoded = jwt.verify(token, JWT_SECRET) as CompanyTokenPayload
    if (decoded.role !== 'company') return null
    return decoded
  } catch {
    return null
  }
}

export function getAdminFromCookies(): AdminTokenPayload | null {
  try {
    const token = cookies().get('admin_token')?.value
    if (!token) return null
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload
    if (decoded.role !== 'admin') return null
    return decoded
  } catch {
    return null
  }
}
