export interface Bus {
  _id?: string
  companyId: string
  companyName: string
  busName: string
  busType: 'AC' | 'Non-AC' | 'Sleeper'
  /** Operator's own logo, shown in search results and on the ticket. Falls back to a generic bus mark. */
  logoUrl?: string
  from: string
  to: string
  date: string // YYYY-MM-DD
  departureTime: string // HH:MM
  arrivalTime: string // HH:MM
  price: number
  totalSeats: number
  /** Seats taken by a BusHub booking (a live hold or a paid ticket). Never edited by hand. */
  bookedSeats: string[]
  /** Seats the operator sold at their own counter, or otherwise wants kept off sale. */
  blockedSeats: string[]
  commissionRate: number
  status: 'active' | 'cancelled'
  createdAt: string
}

export interface Booking {
  _id?: string
  bookingCode: string
  busId: string
  busName: string
  companyName: string
  /** Copied from the bus at booking time so the ticket keeps its logo if the bus is edited later. */
  logoUrl?: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  commissionRate: number
  commissionAmount: number
  companyPayout: number
  passengerName: string
  passengerPhone: string
  passengerEmail?: string
  paymentStatus: 'pending' | 'paid'
  paymentMethod?: 'bkash' | 'nagad' | 'card'
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded'
  qrCode: string
  source: 'web' | 'whatsapp'
  createdAt: string
  validUntil: string
  holdExpiresAt: string
  checkedIn: boolean
  checkedInAt?: string
  refundedAt?: string
}

export interface Company {
  _id?: string
  name: string
  ownerName: string
  email: string
  phone: string
  passwordHash: string
  status: 'pending' | 'approved' | 'suspended'
  createdAt: string
  /** Set by "Forgot password" on the operator login; cleared when the admin issues a new one. */
  passwordResetRequestedAt?: Date
  passwordResetAt?: string
}

export interface WhatsAppSession {
  _id?: string
  phone: string
  step: 'idle' | 'awaiting_route' | 'awaiting_date'
  from?: string
  to?: string
  updatedAt: string
}
