import type { StaffRole } from '@/lib/auth'
import { tripMoney, type TripCost } from '@/lib/tripMoney'

export interface Me {
  companyId: string
  companyName: string
  email: string
  role: StaffRole
  staffId?: string
  name: string
}

export interface CounterSeat {
  seat: string
  soldBy: string
  staffId: string | null
  soldAt: string | null
}

/** A ticket sold on BusHub, as the company sees it: no passenger name or phone. */
export interface OnlineTicket {
  code: string
  bookedAt: string | null
  seats: string[]
  /** What the passenger paid. */
  total: number
  /** What BusHub pays the company for it. */
  payout: number
  boarded: boolean
}

export interface CompanyTrip {
  _id: string
  fleetId: string | null
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  arrivalTime: string
  boardingPoint: string
  price: number
  totalSeats: number
  departed: boolean
  onlineSeats: string[]
  heldSeats: string[]
  counterSeats: CounterSeat[]
  /** Manager only. */
  onlineTickets?: OnlineTicket[]
  /** Manager only. */
  costs?: TripCost[]
}

export interface FleetOption {
  _id: string
  name: string
  busType: string
  totalSeats: number
}

export interface TripsData {
  me: { name: string; role: StaffRole; staffId: string | null }
  fleet: FleetOption[]
  cities: string[]
  trips: CompanyTrip[]
}

/** Seats per trip by who sold them. */
export function tripCounts(trip: CompanyTrip) {
  const online = trip.onlineSeats.length
  const held = trip.heldSeats.length
  const counter = trip.counterSeats.length
  return { online, held, counter, free: Math.max(0, trip.totalSeats - online - held - counter) }
}

/** A trip's money as the manager sees it (lib/tripMoney). */
export function companyTripMoney(trip: CompanyTrip) {
  return tripMoney({
    price: trip.price,
    totalSeats: trip.totalSeats,
    counterSeats: trip.counterSeats.length,
    heldSeats: trip.heldSeats.length,
    online: (trip.onlineTickets || []).map((t) => ({ seats: t.seats.length, total: t.total, payout: t.payout })),
    costs: trip.costs || [],
  })
}
