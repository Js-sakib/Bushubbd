import { phoneDigits } from './phone'

/**
 * Reading what a passenger types to get their tickets sent again: a mobile number (any format,
 * English or Bangla digits), an email or a ticket number. The tickets only ever go to the number
 * or email they were booked with (see /api/tickets/resend), never onto the screen.
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
