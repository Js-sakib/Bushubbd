export interface Bus {
  _id: string
  companyId: string
  companyName: string
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  price: number
  totalSeats: number
  bookedSeats: string[]
  blockedSeats?: string[]
  status: string
}

export interface Booking {
  _id: string
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
}

export interface CompanyRow {
  _id: string
  name: string
  ownerName: string
  email: string
  phone: string
  status: string
  createdAt: string
  /** Set when the operator used "Forgot password"; cleared once the admin resets it. */
  passwordResetRequestedAt?: string
}

export type Section = 'dashboard' | 'bookings' | 'buses' | 'companies'
