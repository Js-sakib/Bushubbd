import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export interface CompanyTokenPayload {
  companyId: string
  email: string
  role: 'company'
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
