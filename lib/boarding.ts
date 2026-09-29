/**
 * Where the bus leaves from: a counter or stand the admin types once per trip, and an optional
 * Google Maps link to it. Both are copied onto every ticket for that trip.
 */
export const MAX_BOARDING_POINT = 120

/** "  Kalabagan   counter, Dhaka " → "Kalabagan counter, Dhaka"; '' when nothing was typed. */
export function cleanBoardingPoint(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_BOARDING_POINT)
}

/** A map link: undefined when empty, null when it isn't an https:// link. */
export function cleanMapUrl(value: unknown): string | undefined | null {
  const url = String(value ?? '').trim()
  if (!url) return undefined
  return /^https:\/\/\S+$/i.test(url) && url.length <= 500 ? url : null
}
