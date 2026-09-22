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
