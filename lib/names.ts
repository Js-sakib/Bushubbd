/** "  Green   Line " → "Green Line": how a bus or company name is stored and shown. */
export function cleanName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

/** "GREEN line" and "Green  Line" are the same name; this key is what uniqueness is checked on. */
export function nameKey(value: unknown): string {
  return cleanName(value).toLowerCase()
}

export const BUS_TYPES = ['AC', 'Non-AC', 'Sleeper'] as const
export const MAX_BUS_SEATS = 60

/** A logo link, undefined when left empty, or null when it isn't a web address. */
export function cleanLogoUrl(value: unknown): string | undefined | null {
  const url = String(value ?? '').trim()
  if (!url) return undefined
  return /^https?:\/\/\S+$/i.test(url) ? url : null
}
