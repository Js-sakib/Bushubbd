import { phoneDigits } from './phone'

/**
 * Finding a passenger's tickets again from the mobile number or email they booked with plus
 * their name, for someone who lost the ticket page. Both must match, and wrong tries are
 * counted (see the lookup route), so nobody can open another person's ticket by guessing.
 */

/** Bangla digits (০১২…) as English ones, so a number typed on a Bangla keyboard works too. */
export function latinDigits(input: string): string {
  return String(input || '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
}

/** The 10 digits of a Bangladeshi mobile number (1XXXXXXXXX), however it was typed; otherwise null. */
export function mobileCore(input: string): string | null {
  const digits = phoneDigits(latinDigits(input).trim().replace(/^00/, ''))
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

/** A ticket number like BH-20261005-9WXETKA99U, written any way (small letters, spaces, Bangla digits); otherwise null. */
export function ticketCode(input: string): string | null {
  const code = latinDigits(input).toUpperCase().replace(/\s+/g, '')
  return /^BH-?\d{8}-?[A-Z0-9]{4,12}$/.test(code) ? code.replace(/^BH-?(\d{8})-?/, 'BH-$1-') : null
}

export function looksLikeEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || '').trim())
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The exact email, whatever its capitals. */
export function emailPattern(email: string): RegExp {
  return new RegExp(`^\\s*${escapeRegex(email.trim())}\\s*$`, 'i')
}

/** Titles many names start with, which people add or leave out: Md, Mohammad, Mst, Mrs... */
const TITLES = new Set(['md', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'mst', 'most', 'mosammat', 'mossammat', 'mrs', 'mr', 'ms', 'miss', 'sk', 'sheikh'])

/** A name as its words: small letters, without dots, commas or titles like Md. */
export function nameWords(name: string): string[] {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,'"`’()-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w))
}

/**
 * The full name as booked (in any order, with or without Md and the like), or just the first
 * name, counts as a match.
 */
export function nameMatches(typed: string, booked: string): boolean {
  const a = nameWords(typed)
  const b = nameWords(booked)
  if (a.length === 0 || a.join('').length < 2 || b.length === 0) return false
  const same = a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')
  return same || (a.length === 1 && a[0] === b[0])
}
