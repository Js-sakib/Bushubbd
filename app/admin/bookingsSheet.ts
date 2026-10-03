import { formatTripDate } from '@/lib/dates'
import type { Column, Sheet } from '@/lib/sheet'
import { bookingStatus } from './BookingList'
import type { Booking } from './types'

const STATUS_WORD = { boarded: 'Boarded', paid: 'Paid', pending: 'Pending', refunded: 'Refunded', expired: 'Expired' } as const
const METHOD = (m?: string) => (m === 'bkash' ? 'bKash' : m === 'nagad' ? 'Nagad' : m === 'card' ? 'Card' : m || '')
/** Paid tickets count as sales; holds, expired and refunded tickets carry 0 in the money columns. */
export const isSale = (b: Booking) => bookingStatus(b) === 'paid' || bookingStatus(b) === 'boarded'
const day = (date: string) => formatTripDate(date).split(' ')[0]
const dhakaDay = (iso: string) => (iso ? new Date(Date.parse(iso) + 6 * 3600 * 1000).toISOString().slice(0, 10) : '')

const int = (header: string): Column => ({ header, kind: 'int', total: true })
const money = (header: string): Column => ({ header, kind: 'money', total: true })

/**
 * The admin's bookings as a workbook: every ticket with the customer's full details, one row per
 * customer (by phone number), and the sales date by date.
 */
export function adminBookingSheets(list: Booking[], notes: string[]): Sheet[] {
  const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const bookings: Sheet = {
    name: 'Bookings',
    title: 'BusHub bookings · customer details',
    notes,
    columns: [
      { header: 'Booked at', kind: 'datetime' },
      { header: 'Booking code' },
      { header: 'Customer name' },
      { header: 'Phone' },
      { header: 'Email' },
      { header: 'Bought on' },
      { header: 'Paid by' },
      { header: 'Paid at', kind: 'datetime' },
      { header: 'Company' },
      { header: 'Bus' },
      { header: 'Number plate' },
      { header: 'From' },
      { header: 'To' },
      { header: 'Travel date', kind: 'date' },
      { header: 'Day' },
      { header: 'Time' },
      { header: 'Boarding point', kind: 'wrap' },
      { header: 'Seats' },
      int('Seat count'),
      money('Ticket price'),
      { header: 'Commission %', kind: 'int' },
      money('BusHub commission'),
      money('Company gets'),
      { header: 'Status' },
      { header: 'Boarded at', kind: 'datetime' },
      { header: 'Refunded at', kind: 'datetime' },
      { header: 'Invoice' },
    ],
    rows: sorted.map((b) => {
      const sale = isSale(b)
      return [
        b.createdAt,
        b.bookingCode,
        b.passengerName,
        b.passengerPhone,
        b.passengerEmail || '',
        b.source === 'whatsapp' ? 'WhatsApp' : 'Website',
        METHOD(b.paymentMethod),
        b.paidAt || '',
        b.companyName,
        b.busName,
        b.plateNumber || '',
        b.from,
        b.to,
        b.date,
        day(b.date),
        b.departureTime,
        b.boardingPoint || '',
        b.seats.join(', '),
        b.seats.length,
        sale ? b.totalPrice : 0,
        b.commissionRate ?? '',
        sale ? b.commissionAmount || 0 : 0,
        sale ? b.companyPayout ?? b.totalPrice : 0,
        STATUS_WORD[bookingStatus(b)],
        b.checkedInAt || '',
        b.refundedAt || '',
        b.invoiceNumber || '',
      ]
    }),
  }

  type Customer = { name: string; phone: string; email: string; tickets: number; seats: number; spent: number; first: string; last: string; routes: Set<string>; companies: Set<string> }
  const people = new Map<string, Customer>()
  for (const b of sorted) {
    if (!isSale(b) && bookingStatus(b) !== 'refunded') continue
    const key = (b.passengerPhone || '').replace(/\D/g, '').slice(-10) || b.passengerName
    const c = people.get(key) || { name: b.passengerName, phone: b.passengerPhone, email: '', tickets: 0, seats: 0, spent: 0, first: b.createdAt, last: b.createdAt, routes: new Set<string>(), companies: new Set<string>() }
    c.name = b.passengerName || c.name
    c.email = b.passengerEmail || c.email
    c.last = b.createdAt
    c.routes.add(`${b.from} → ${b.to}`)
    c.companies.add(b.companyName)
    if (isSale(b)) {
      c.tickets += 1
      c.seats += b.seats.length
      c.spent += b.totalPrice
    }
    people.set(key, c)
  }
  const customers: Sheet = {
    name: 'Customers',
    title: 'BusHub customers · who bought',
    notes,
    columns: [
      { header: 'Customer name' },
      { header: 'Phone' },
      { header: 'Email' },
      int('Tickets'),
      int('Seats'),
      money('Total spent'),
      { header: 'First bought', kind: 'datetime' },
      { header: 'Last bought', kind: 'datetime' },
      { header: 'Routes', kind: 'wrap' },
      { header: 'Bus companies', kind: 'wrap' },
    ],
    rows: Array.from(people.values())
      .sort((a, b) => b.spent - a.spent)
      .map((c) => [c.name, c.phone, c.email, c.tickets, c.seats, c.spent, c.first, c.last, Array.from(c.routes).join('; '), Array.from(c.companies).join('; ')]),
  }

  const days = new Map<string, { bookings: number; seats: number; sales: number; commission: number; company: number; refunds: number; buyers: Set<string> }>()
  for (const b of sorted) {
    const d = dhakaDay(b.createdAt)
    const row = days.get(d) || { bookings: 0, seats: 0, sales: 0, commission: 0, company: 0, refunds: 0, buyers: new Set<string>() }
    if (isSale(b)) {
      row.bookings += 1
      row.seats += b.seats.length
      row.sales += b.totalPrice
      row.commission += b.commissionAmount || 0
      row.company += b.companyPayout ?? b.totalPrice
      row.buyers.add(b.passengerPhone)
    } else if (bookingStatus(b) === 'refunded') row.refunds += 1
    days.set(d, row)
  }
  const byDay: Sheet = {
    name: 'Date by date',
    title: 'BusHub sales · by the day bought',
    notes,
    columns: [{ header: 'Date', kind: 'date' }, { header: 'Day' }, int('Tickets sold'), int('Customers'), int('Seats'), money('Sales'), money('BusHub commission'), money('Company gets'), int('Refunded')],
    rows: Array.from(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, r]) => [d, day(d), r.bookings, r.buyers.size, r.seats, r.sales, r.commission, r.company, r.refunds]),
  }

  return [bookings, customers, byDay]
}
