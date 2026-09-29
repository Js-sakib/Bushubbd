/** Bangladeshi mobiles are usually typed as 01XXXXXXXXX; wa.me needs 8801XXXXXXXXX. Hotlines have no WhatsApp. */
export function whatsappNumber(phone: string): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (/^8801\d{9}$/.test(digits)) return digits
  if (/^01\d{9}$/.test(digits)) return `88${digits}`
  return null
}

/** A number the phone's dialer understands: digits, with a leading + kept. */
export function telHref(phone: string): string {
  const trimmed = (phone || '').trim()
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${trimmed.replace(/\D/g, '')}`
}

/** Only the digits, for spotting the same number typed two ways. */
export function phoneDigits(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.startsWith('880') ? digits.slice(2) : digits
}

/**
 * One key per buyer's number for the per-number ticket limits, however it was typed:
 * "+880 1712-345678", "008801712345678", "1712345678" and "01712345678" are one buyer.
 */
export function phoneKey(phone: unknown): string {
  const digits = phoneDigits(String(phone ?? '').trim().replace(/^00/, ''))
  return /^1\d{9}$/.test(digits) ? `0${digits}` : digits
}
