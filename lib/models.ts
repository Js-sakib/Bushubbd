export interface Bus {
  _id?: string
  companyId: string
  companyName: string
  busName: string
  busType: 'AC' | 'Non-AC' | 'Sleeper'
  from: string
  to: string
  date: string // YYYY-MM-DD
  departureTime: string // HH:MM
  arrivalTime: string // HH:MM
  price: number
  totalSeats: number
  bookedSeats: string[]
  status: 'active' | 'cancelled'
  createdAt: string
}

export interface Booking {
  _id?: string
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
  passengerName: string
  passengerPhone: string
  passengerEmail?: string
  paymentStatus: 'pending' | 'paid'
  paymentMethod?: 'bkash' | 'nagad' | 'card'
  status: 'confirmed' | 'expired' | 'cancelled'
  qrCode: string
  source: 'web' | 'whatsapp'
  createdAt: string
  validUntil: string
  checkedIn: boolean
  checkedInAt?: string
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
}

export interface WhatsAppSession {
  _id?: string
  phone: string
  step: 'idle' | 'awaiting_route' | 'awaiting_date'
  from?: string
  to?: string
  updatedAt: string
}
