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
