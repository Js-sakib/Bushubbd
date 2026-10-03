/** A bus the admin listed once; trips are created from it. */
export interface FleetBus {
  _id: string
  name: string
  companyId: string
  companyName: string
  busType: string
  totalSeats: number
  logoUrl?: string
  plateNumber?: string
  commissionRate?: number
  tripCount: number
}

export interface Bus {
  _id: string
  /** Number plate (from the bus list); admin lists only. */
  plateNumber?: string
  fleetId?: string
  companyId: string
  companyName: string
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  arrivalTime?: string
  boardingPoint?: string
  boardingMapUrl?: string
  price: number
  commissionRate?: number
  totalSeats: number
  bookedSeats: string[]
  blockedSeats?: string[]
  status: string
}

export interface Booking {
  _id: string
  /** Number plate of the bus (from the bus list). */
  plateNumber?: string
  bookingCode: string
  busId: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  commissionAmount: number
  companyPayout: number
  passengerName: string
  passengerPhone: string
  paymentStatus: string
  status: string
  source?: string
  checkedIn?: boolean
  createdAt: string
  /** Full details, from /api/admin/bookings (the date-range list and its Excel sheet). */
  passengerEmail?: string
  paymentMethod?: string
  paidAt?: string
  checkedInAt?: string
  refundedAt?: string
  boardingPoint?: string
  busType?: string
  bags?: number
  pricePerSeat?: number
  commissionRate?: number
  invoiceNumber?: string
  invoiceStatus?: string
}

export interface CompanyRow {
  _id: string
  name: string
  ownerName: string
  email: string
  phone: string
  status: string
  createdAt: string
  /** BusHub's commission on all the company's tickets, in percent. */
  commissionRate?: number
  /** Set when the operator used "Forgot password"; cleared once the admin resets it. */
  passwordResetRequestedAt?: string
}

/** A bus company the team is talking to about joining. */
export interface LeadRow {
  _id: string
  companyName: string
  contactName: string
  phone: string
  altPhone: string
  area: string
  source: string
  status: string
  followUpDate: string
  notes: { text: string; at: string }[]
  lastContactedAt?: string
  createdAt: string
  updatedAt: string
}

/** Details carried from a lead into the Add a bus company form. */
export interface CompanyPrefill {
  name: string
  ownerName: string
  phone: string
}

export type Section = 'dashboard' | 'bookings' | 'buses' | 'costs' | 'companies' | 'leads'
