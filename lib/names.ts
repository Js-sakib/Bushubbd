/** "  Green   Line " → "Green Line": how a bus or company name is stored and shown. */
export function cleanName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

/** "GREEN line" and "Green  Line" are the same name; this key is what uniqueness is checked on. */
export function nameKey(value: unknown): string {
  return cleanName(value).toLowerCase()
}

/**
 * A number plate as typed ("dhaka metro-ba 11-2345"), tidied: one space between words, Latin
 * letters in capitals. Returns undefined when empty and null when it can't be a plate.
 */
export function cleanPlate(value: unknown): string | undefined | null {
  const plate = cleanName(value).replace(/\s*-\s*/g, '-').toUpperCase()
  if (!plate) return undefined
  return /^[\p{L}\p{N}][\p{L}\p{N} -]{3,29}$/u.test(plate) ? plate : null
}

/** "DHAKA METRO-BA 11-2345" and "Dhaka Metro Ba 112345" are the same plate. */
export function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, '')
}

export const BUS_TYPES = ['AC', 'Non-AC', 'Sleeper'] as const
export const MAX_BUS_SEATS = 60

/** A logo link, undefined when left empty, or null when it isn't a web address. */
export function cleanLogoUrl(value: unknown): string | undefined | null {
  const url = String(value ?? '').trim()
  if (!url) return undefined
  return /^https?:\/\/\S+$/i.test(url) ? url : null
}
