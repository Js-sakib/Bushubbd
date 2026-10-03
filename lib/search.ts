/**
 * The search boxes on the admin, management and counter pages: every word typed must appear
 * somewhere in the item (route, number plate, bus, date, code, name...), in any order and case.
 * Plates match with or without spaces and dashes ("ba 112345" finds "DHAKA METRO-BA 11-2345").
 */
export function matches(query: string, ...fields: unknown[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = fields
    .flat()
    .filter((f) => f !== null && f !== undefined && f !== '')
    .map((f) => String(f).toLowerCase())
    .join(' ')
  const squashed = text.replace(/[\s-]/g, '')
  return words.every((w) => text.includes(w) || squashed.includes(w.replace(/-/g, '')))
}
