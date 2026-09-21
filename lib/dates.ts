const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Formatted by hand rather than toLocaleDateString: Node and the browser disagree on
// some abbreviations ("Sept" vs "Sep"), which breaks hydration.
export function formatTripDate(date: string): string {
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return `${DAYS[parsed.getUTCDay()]} ${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
}

export function formatShortDay(date: Date): string {
  return DAYS[date.getUTCDay()]
}
