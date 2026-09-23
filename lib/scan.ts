/** Bangladesh has no daylight saving, so Dhaka is always UTC+6. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar date in Dhaka for an instant, as YYYY-MM-DD. The server runs in UTC. */
export function dhakaDate(at: Date = new Date()): string {
  return new Date(at.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10)
}

/** The UTC instant at which a Dhaka calendar day begins. */
export function startOfDhakaDay(date: string): Date {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - DHAKA_OFFSET_MS)
}

/** The last `days` Dhaka calendar dates, oldest first, ending today. */
export function lastDhakaDays(days: number, at: Date = new Date()): string[] {
  const today = startOfDhakaDay(dhakaDate(at)).getTime()
  return Array.from({ length: days }, (_, i) => dhakaDate(new Date(today + (i - days + 1) * DAY_MS)))
}

const BOOKING_CODE = /BH-\d{8}-[A-Z0-9]{5}/i

/**
 * Pull a booking code out of whatever the scanner read. The QR holds the verify URL
 * (https://…/verify/BH-…), but a code typed by hand works too.
 */
export function extractBookingCode(raw: string): string | null {
  const match = BOOKING_CODE.exec(raw || '')
  return match ? match[0].toUpperCase() : null
}

/**
 * A ticket stays good until 6am Dhaka time the morning after its travel date, so a
 * late-night departure or a delayed bus still boards. It used to run 24 hours from the
 * moment of booking, which expired every ticket bought more than a day ahead.
 */
export function ticketExpiry(travelDate: string): string {
  return new Date(startOfDhakaDay(travelDate).getTime() + 30 * 60 * 60 * 1000).toISOString()
}

export type ScanResult =
  | 'valid'
  | 'already_used'
  | 'wrong_day'
  | 'unpaid'
  | 'expired'
  | 'refunded'
  | 'cancelled'
  | 'other_operator'
  | 'not_found'

export interface ScannableTicket {
  paymentStatus: string
  status: string
  checkedIn?: boolean
  date: string
}

/**
 * Decide what a scan at the bus door means. 'valid' says the ticket may board; the caller
 * still has to claim the check-in atomically, since two phones can scan the same ticket.
 * `scanner` is the operator's company id, or 'admin', who may scan any bus.
 */
export function judgeTicket(
  ticket: ScannableTicket,
  busCompanyId: string | undefined,
  scanner: string,
  now: Date = new Date()
): ScanResult {
  if (scanner !== 'admin' && busCompanyId !== scanner) return 'other_operator'
  if (ticket.paymentStatus !== 'paid') return 'unpaid'
  if (ticket.status === 'refunded') return 'refunded'
  if (ticket.status === 'cancelled') return 'cancelled'
  if (ticket.checkedIn) return 'already_used'
  if (new Date(ticketExpiry(ticket.date)).getTime() < now.getTime()) return 'expired'
  // Genuine, but for a later trip. Yesterday's late-night trips pass: the expiry check
  // above keeps them valid until 6am.
  if (ticket.date > dhakaDate(now)) return 'wrong_day'
  return 'valid'
}

export interface DayCount {
  date: string
  tickets: number
  passengers: number
  rejected: number
}

/** Boardings per Dhaka day for the last `days` days, newest first, plus the totals. */
export function summarizeScans(
  scans: { scannedAt: string; result: string; seatCount?: number }[],
  now: Date = new Date(),
  days = 7
) {
  const byDay: DayCount[] = lastDhakaDays(days, now).map((date) => ({ date, tickets: 0, passengers: 0, rejected: 0 }))
  for (const scan of scans) {
    const day = byDay.find((d) => d.date === dhakaDate(new Date(scan.scannedAt)))
    if (!day) continue
    if (scan.result === 'valid') {
      day.tickets += 1
      day.passengers += scan.seatCount || 0
    } else {
      day.rejected += 1
    }
  }
  const week = byDay.reduce(
    (sum, d) => ({ tickets: sum.tickets + d.tickets, passengers: sum.passengers + d.passengers, rejected: sum.rejected + d.rejected }),
    { tickets: 0, passengers: 0, rejected: 0 }
  )
  return { today: byDay[byDay.length - 1], week, days: [...byDay].reverse() }
}
