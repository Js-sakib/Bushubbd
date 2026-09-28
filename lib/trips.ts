import { dhakaDate } from './scan'

/** The time of day in Dhaka as HH:MM. The server runs in UTC; Dhaka is always UTC+6. */
export function dhakaClock(at: Date = new Date()): string {
  return new Date(at.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

/** True once a trip's departure time has passed in Dhaka: it can no longer be sold or changed. */
export function tripDeparted(date: string, departureTime: string, at: Date = new Date()): boolean {
  const today = dhakaDate(at)
  if (date !== today) return date < today
  return String(departureTime) <= dhakaClock(at)
}
