export function generateSeatLabels(totalSeats: number): string[] {
  return Array.from({ length: totalSeats }, (_, i) => `${Math.floor(i / 4) + 1}${String.fromCharCode(65 + (i % 4))}`)
}

interface SeatState {
  bookedSeats?: string[]
  blockedSeats?: string[]
}

/** Every seat a customer cannot buy: booked through BusHub, or blocked by the operator. */
export function takenSeats(bus: SeatState): string[] {
  return Array.from(new Set([...(bus.bookedSeats || []), ...(bus.blockedSeats || [])]))
}

export function seatsLeft(bus: SeatState & { totalSeats: number }): number {
  return Math.max(0, bus.totalSeats - takenSeats(bus).length)
}

/** The most seats one booking can hold; the search form offers up to 6 passengers. */
export const MAX_SEATS_PER_BOOKING = 6

/**
 * Checks a seat list sent by a customer or the admin: every seat must exist on this bus and
 * appear once. Returns what is wrong, or null when the list is fine.
 */
export function seatSelectionError(seats: unknown, totalSeats: number, max = MAX_SEATS_PER_BOOKING): string | null {
  if (!Array.isArray(seats) || seats.length === 0) return 'Choose at least one seat'
  if (seats.length > max) return `One booking can hold at most ${max} seats`
  const valid = new Set(generateSeatLabels(totalSeats))
  const seen = new Set<string>()
  for (const seat of seats) {
    if (typeof seat !== 'string' || !valid.has(seat)) return `Seat ${String(seat)} does not exist on this bus`
    if (seen.has(seat)) return `Seat ${seat} is listed twice`
    seen.add(seat)
  }
  return null
}
