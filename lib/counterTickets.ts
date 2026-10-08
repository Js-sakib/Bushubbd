import { ObjectId, type Db } from 'mongodb'
import { changeCounterSeats, type SeatActor } from './counterSeats'
import { isDuplicateKeyError } from './db'
import { startOfDhakaDay } from './scan'
import { generateBookingCode } from './tickets'
import { latinDigits, mobileCore } from './ticketLookup'
import { tripDeparted } from './trips'
import { platesByTrip } from './plates'

/**
 * A ticket sold at a bus company's counter: one sale of one or more seats, with the passenger,
 * the fare and how it was paid. It is printed on the counter's receipt printer with a QR code the
 * bus staff scan at the door, like a BusHub ticket. The seats themselves are still marked through
 * counterSales (lib/counterSeats), so a seat can never be sold twice, online or at a counter.
 */

export const PAYMENT_METHODS = ['cash', 'bkash', 'nagad'] as const
export type CounterPayment = (typeof PAYMENT_METHODS)[number]

export interface CounterTicket {
  _id?: ObjectId
  ticketCode: string
  busId: string
  companyId: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  busName: string
  plateNumber?: string
  boardingPoint?: string
  seats: string[]
  passengerName?: string
  passengerPhone?: string
  /** The 10 digits after 0 (1712345678), to find a regular passenger however the number is typed. */
  phoneCore?: string
  /** Price of one seat on this ticket; the trip's price unless the counter changed it. */
  fare: number
  tripPrice: number
  total: number
  discountNote?: string
  paymentMethod: CounterPayment
  /** bKash or Nagad transaction ID. */
  paymentRef?: string
  /** Cash handed over, to work out the change. */
  received?: number
  soldBy: string
  staffId?: string
  role: 'manager' | 'counter'
  soldAt: string
  status: 'sold' | 'cancelled'
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  checkedIn: boolean
  checkedInAt?: string
  checkedInBy?: string
  checkedInByName?: string
}

type Seller = Extract<SeatActor, { kind: 'company' }>
type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string }
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error })

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const wholeTaka = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(latinDigits(String(v)))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN
}

export interface SaleInput {
  busId: unknown
  seats: unknown
  passengerName?: unknown
  passengerPhone?: unknown
  paymentMethod?: unknown
  paymentRef?: unknown
  fare?: unknown
  discountNote?: unknown
  received?: unknown
}

/** Sells the seats as one ticket: every seat or none, then saves the ticket with its money. */
export async function sellCounterTicket(db: Db, input: SaleInput, seller: Seller): Promise<Result<CounterTicket>> {
  const busId = String(input.busId || '')
  if (!ObjectId.isValid(busId)) return fail(400, 'Choose a trip first')
  const bus = await db.collection('buses').findOne({ _id: new ObjectId(busId) })
  if (!bus) return fail(404, 'Trip not found')
  if (bus.companyId !== seller.companyId) return fail(403, 'This trip belongs to another company')

  const method = String(input.paymentMethod || 'cash') as CounterPayment
  if (!PAYMENT_METHODS.includes(method)) return fail(400, 'Choose cash, bKash or Nagad')

  const phoneRaw = clean(input.passengerPhone, 30)
  const phoneCore = phoneRaw ? mobileCore(phoneRaw) : null
  if (phoneRaw && !phoneCore) return fail(400, 'Write the phone number like 01712345678')
  const passengerName = clean(input.passengerName, 60)

  const tripPrice = Math.max(0, Math.round(Number(bus.price) || 0))
  const asked = wholeTaka(input.fare)
  if (Number.isNaN(asked)) return fail(400, 'Write the fare as a number')
  const fare = asked ?? tripPrice
  if (fare > tripPrice * 5 && fare > 0) return fail(400, `The fare looks wrong: the trip price is ৳${tripPrice}`)
  const discountNote = clean(input.discountNote, 120)
  if (fare < tripPrice && discountNote.length < 3) return fail(400, `Say why the fare is less than ৳${tripPrice}`)

  const seats = Array.isArray(input.seats) ? (input.seats as unknown[]).map((s) => String(s)) : []
  const total = fare * seats.length

  const received = wholeTaka(input.received)
  if (Number.isNaN(received)) return fail(400, 'Write the cash received as a number')
  if (method === 'cash' && received !== null && received < total) return fail(400, `Cash received is less than the total ৳${total}`)
  const paymentRef = method === 'cash' ? '' : clean(input.paymentRef, 24).toUpperCase().replace(/[^A-Z0-9]/g, '')

  // The seat rules (already sold online or at a counter, bus left, bad seat) live in one place.
  const seatResult = await changeCounterSeats(db, busId, seats, 'sell', seller)
  if (seatResult.status !== 200) return fail(seatResult.status, seatResult.body.error || 'Could not sell these seats')

  const [company, plates] = await Promise.all([
    ObjectId.isValid(seller.companyId) ? db.collection('companies').findOne({ _id: new ObjectId(seller.companyId) }, { projection: { name: 1 } }) : null,
    platesByTrip(db, [busId]),
  ])
  const plateNumber = plates.get(busId)
  const ticket: CounterTicket = {
    ticketCode: '',
    busId,
    companyId: seller.companyId,
    companyName: String(company?.name || bus.companyName || ''),
    from: String(bus.from || ''),
    to: String(bus.to || ''),
    date: String(bus.date || ''),
    departureTime: String(bus.departureTime || ''),
    busName: String(bus.busName || ''),
    ...(plateNumber ? { plateNumber } : {}),
    ...(bus.boardingPoint ? { boardingPoint: String(bus.boardingPoint) } : {}),
    seats,
    ...(passengerName ? { passengerName } : {}),
    ...(phoneCore ? { passengerPhone: `0${phoneCore}`, phoneCore } : {}),
    fare,
    tripPrice,
    total,
    ...(fare < tripPrice ? { discountNote } : {}),
    paymentMethod: method,
    ...(paymentRef ? { paymentRef } : {}),
    ...(method === 'cash' && received !== null ? { received } : {}),
    soldBy: seller.name,
    ...(seller.staffId ? { staffId: seller.staffId } : {}),
    role: seller.role,
    soldAt: new Date().toISOString(),
    status: 'sold',
    checkedIn: false,
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    ticket.ticketCode = generateBookingCode(new Date(), 'CT')
    try {
      await db.collection('counterTickets').insertOne({ ...ticket })
      await db.collection('counterSales').updateMany({ busId, seat: { $in: seats } }, { $set: { ticketCode: ticket.ticketCode, fare } })
      return { ok: true, value: ticket }
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        // The ticket could not be saved: put the seats back on sale rather than leave them sold with no ticket.
        await changeCounterSeats(db, busId, seats, 'unsell', { ...seller, role: 'manager' })
        throw err
      }
    }
  }
  await changeCounterSeats(db, busId, seats, 'unsell', { ...seller, role: 'manager' })
  return fail(500, 'Could not make a ticket code, please try again')
}

/**
 * Cancels a counter ticket: its seats go back on sale and the ticket stays on record, marked
 * cancelled with who did it and why. A counter may cancel only its own tickets; the manager any.
 * A passenger who has boarded, or a bus that has left, can't be cancelled.
 */
export async function cancelCounterTicket(db: Db, code: string, reason: unknown, seller: Seller): Promise<Result<CounterTicket>> {
  const ticket = (await db.collection('counterTickets').findOne({ ticketCode: code, companyId: seller.companyId })) as CounterTicket | null
  if (!ticket) return fail(404, 'Ticket not found')
  if (ticket.status === 'cancelled') return fail(409, 'This ticket is already cancelled')
  if (ticket.checkedIn) return fail(409, 'This passenger has already boarded')
  if (seller.role === 'counter' && ticket.staffId !== seller.staffId) {
    return fail(403, `This ticket was sold by ${ticket.soldBy}. Ask your manager to cancel it.`)
  }
  const why = clean(reason, 160)
  if (why.length < 3) return fail(400, 'Say why the ticket is cancelled')
  if (tripDeparted(ticket.date, ticket.departureTime)) return fail(409, 'This bus has already left')

  const claimed = await db.collection('counterTickets').updateOne(
    { _id: ticket._id, status: 'sold', checkedIn: { $ne: true } },
    { $set: { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: seller.name, cancelReason: why } }
  )
  if (claimed.modifiedCount === 0) return fail(409, 'This ticket was just changed. Refresh and try again.')

  const freed = await changeCounterSeats(db, ticket.busId, ticket.seats, 'unsell', seller)
  if (freed.status !== 200) {
    await db.collection('counterTickets').updateOne({ _id: ticket._id }, { $set: { status: 'sold' }, $unset: { cancelledAt: '', cancelledBy: '', cancelReason: '' } })
    return fail(freed.status, freed.body.error || 'Could not free the seats')
  }
  const updated = (await db.collection('counterTickets').findOne({ _id: ticket._id })) as CounterTicket
  return { ok: true, value: updated }
}

export interface DayReport {
  day: string
  tickets: CounterTicket[]
  totals: {
    tickets: number
    seats: number
    money: number
    byMethod: Record<CounterPayment, number>
    cancelled: number
    cancelledMoney: number
  }
}

/** One Dhaka day of counter tickets, newest first, with the money to hand over by payment method. */
export async function counterDay(db: Db, companyId: string, day: string, staffId?: string): Promise<DayReport> {
  const from = startOfDhakaDay(day)
  const to = new Date(from.getTime() + 86_400_000)
  const tickets = (await db
    .collection('counterTickets')
    .find({ companyId, soldAt: { $gte: from.toISOString(), $lt: to.toISOString() }, ...(staffId ? { staffId } : {}) })
    .sort({ soldAt: -1 })
    .limit(2000)
    .toArray()) as CounterTicket[]
  const totals = { tickets: 0, seats: 0, money: 0, byMethod: { cash: 0, bkash: 0, nagad: 0 }, cancelled: 0, cancelledMoney: 0 }
  for (const t of tickets) {
    if (t.status === 'cancelled') {
      totals.cancelled += 1
      totals.cancelledMoney += t.total
      continue
    }
    totals.tickets += 1
    totals.seats += t.seats.length
    totals.money += t.total
    totals.byMethod[t.paymentMethod] += t.total
  }
  return { day, tickets, totals }
}

/** The last few counter tickets for this phone number at this company, to fill in a regular's name. */
export async function ticketsForPhone(db: Db, companyId: string, phone: string) {
  const core = mobileCore(phone)
  if (!core) return []
  const rows = await db
    .collection('counterTickets')
    .find({ companyId, phoneCore: core }, { projection: { passengerName: 1, from: 1, to: 1, date: 1, seats: 1, soldAt: 1 } })
    .sort({ soldAt: -1 })
    .limit(5)
    .toArray()
  return rows.map((r) => ({ passengerName: r.passengerName || '', from: r.from, to: r.to, date: r.date, seats: r.seats, soldAt: r.soldAt }))
}
