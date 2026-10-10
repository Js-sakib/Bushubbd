import jwt from 'jsonwebtoken'
import { createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * The key that signs every login. A live site with no JWT_SECRET signs and accepts no logins at
 * all: the old fallback key is public, so anyone could have made an admin login with it.
 */
function jwtSecret(): string | null {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  return process.env.NODE_ENV === 'production' ? null : 'dev-secret-change-me'
}

export const LOGIN_NOT_CONFIGURED = 'Login is not set up on this server yet'

/** Compares two secrets in the same time whatever they hold, so timing gives nothing away. */
export function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

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

/** Null when the server has no JWT_SECRET (see jwtSecret): the login then has to say so. */
export function signCompanyToken(payload: Omit<CompanyTokenPayload, 'role'>): string | null {
  const secret = jwtSecret()
  return secret ? jwt.sign({ ...payload, role: 'company' }, secret, { expiresIn: '7d' }) : null
}

export function signAdminToken(): string | null {
  const secret = jwtSecret()
  return secret ? jwt.sign({ role: 'admin' }, secret, { expiresIn: '7d' }) : null
}

export function getCompanyFromCookies(): CompanyTokenPayload | null {
  try {
    const token = cookies().get('company_token')?.value
    const secret = jwtSecret()
    if (!token || !secret) return null
    const decoded = jwt.verify(token, secret) as CompanyTokenPayload
    if (decoded.role !== 'company') return null
    return decoded
  } catch {
    return null
  }
}

export function getAdminFromCookies(): AdminTokenPayload | null {
  try {
    const token = cookies().get('admin_token')?.value
    const secret = jwtSecret()
    if (!token || !secret) return null
    const decoded = jwt.verify(token, secret) as AdminTokenPayload
    if (decoded.role !== 'admin') return null
    return decoded
  } catch {
    return null
  }
}
