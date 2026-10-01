import type { StaffRole } from '@/lib/auth'

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

export interface OnlineTicket {
  code: string
  passengerName: string
  seats: string[]
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
