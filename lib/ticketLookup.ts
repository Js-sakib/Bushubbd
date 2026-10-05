import { phoneDigits } from './phone'

/**
 * Finding a passenger's tickets again from the mobile number or email they booked with plus
 * their name, for someone who lost the ticket page. Both must match, and wrong tries are
 * counted (see the lookup route), so nobody can open another person's ticket by guessing.
 */

/** The 10 digits of a Bangladeshi mobile number (1XXXXXXXXX), however it was typed; otherwise null. */
export function mobileCore(input: string): string | null {
  const digits = phoneDigits(String(input || '').trim().replace(/^00/, ''))
  const core = digits.startsWith('0') ? digits.slice(1) : digits
  return /^1\d{9}$/.test(core) ? core : null
}

/**
 * Matches a stored phone number with those 10 digits, written any common way:
 * 01712345678, +8801712345678, +880 1712-345678, 8801712345678.
 */
export function phonePattern(core: string): RegExp {
  const body = core.split('').join('\\D*')
  return new RegExp(`^\\D*(?:8\\D*8\\D*)?(?:0\\D*)?${body}\\D*$`)
}

export function looksLikeEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || '').trim())
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The exact email, whatever its capitals. */
export function emailPattern(email: string): RegExp {
  return new RegExp(`^\\s*${escapeRegex(email.trim())}\\s*$`, 'i')
}

/** A name in one form for comparing: small letters, single spaces, no dots or commas. */
export function nameForm(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,'"`’()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The full name as booked, or just the first name, counts as a match. */
export function nameMatches(typed: string, booked: string): boolean {
  const a = nameForm(typed)
  const b = nameForm(booked)
  if (a.length < 2 || !b) return false
  return a === b || a === b.split(' ')[0]
}
