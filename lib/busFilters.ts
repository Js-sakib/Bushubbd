import { seatsLeft } from './seats'

export interface FilterableBus {
  companyName: string
  busType: string
  departureTime: string
  price: number
  totalSeats: number
  bookedSeats?: string[]
  blockedSeats?: string[]
}

export type SortKey = 'cheapest' | 'expensive' | 'earliest' | 'latest' | 'seats'

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'cheapest', label: 'Price: low to high', hint: 'Cheapest fare first' },
  { key: 'expensive', label: 'Price: high to low', hint: 'Premium buses first' },
  { key: 'earliest', label: 'Departure: earliest', hint: 'Leaves soonest in the day' },
  { key: 'latest', label: 'Departure: latest', hint: 'Night buses first' },
  { key: 'seats', label: 'Most seats free', hint: 'Best chance of sitting together' },
]

export const TIME_SLOTS = [
  { key: 'morning', label: 'Morning', range: '6am – 12pm', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon', range: '12pm – 5pm', from: 12, to: 17 },
  { key: 'evening', label: 'Evening', range: '5pm – 9pm', from: 17, to: 21 },
  { key: 'night', label: 'Night', range: '9pm – 6am', from: 21, to: 6 },
] as const

export type TimeSlotKey = (typeof TIME_SLOTS)[number]['key']

export interface BusFilters {
  types: string[]
  slots: TimeSlotKey[]
  operators: string[]
  maxPrice: number | null
}

export const EMPTY_FILTERS: BusFilters = { types: [], slots: [], operators: [], maxPrice: null }

/** Minutes since midnight for a "HH:MM" departure time. Unparseable times sort last. */
export function minutesOfDay(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || '')
  if (!match) return Number.MAX_SAFE_INTEGER
  return Number(match[1]) * 60 + Number(match[2])
}

function inSlot(time: string, slot: (typeof TIME_SLOTS)[number]): boolean {
  const hour = Math.floor(minutesOfDay(time) / 60)
  if (hour > 23) return false
  // The night slot wraps past midnight, so it is the union of two ranges.
  return slot.from <= slot.to ? hour >= slot.from && hour < slot.to : hour >= slot.from || hour < slot.to
}

export function countActiveFilters(filters: BusFilters): number {
  return (
    filters.types.length +
    filters.slots.length +
    filters.operators.length +
    (filters.maxPrice === null ? 0 : 1)
  )
}

export function applyFilters<T extends FilterableBus>(buses: T[], filters: BusFilters): T[] {
  return buses.filter((bus) => {
    if (filters.types.length && !filters.types.includes(bus.busType)) return false
    if (filters.operators.length && !filters.operators.includes(bus.companyName)) return false
    if (filters.maxPrice !== null && bus.price > filters.maxPrice) return false
    if (filters.slots.length) {
      const slots = TIME_SLOTS.filter((slot) => filters.slots.includes(slot.key))
      if (!slots.some((slot) => inSlot(bus.departureTime, slot))) return false
    }
    return true
  })
}

export function sortBuses<T extends FilterableBus>(buses: T[], sort: SortKey): T[] {
  const copy = [...buses]
  switch (sort) {
    case 'cheapest':
      return copy.sort((a, b) => a.price - b.price || minutesOfDay(a.departureTime) - minutesOfDay(b.departureTime))
    case 'expensive':
      return copy.sort((a, b) => b.price - a.price || minutesOfDay(a.departureTime) - minutesOfDay(b.departureTime))
    case 'earliest':
      return copy.sort((a, b) => minutesOfDay(a.departureTime) - minutesOfDay(b.departureTime) || a.price - b.price)
    case 'latest':
      return copy.sort((a, b) => minutesOfDay(b.departureTime) - minutesOfDay(a.departureTime) || a.price - b.price)
    case 'seats':
      return copy.sort((a, b) => seatsLeft(b) - seatsLeft(a) || a.price - b.price)
    default:
      return copy
  }
}
