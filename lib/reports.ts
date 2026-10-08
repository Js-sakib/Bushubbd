import { ObjectId, type Db } from 'mongodb'
import { dhakaDate, startOfDhakaDay } from './scan'

/**
 * Reports for any date range, compared with the same number of days just before it. One core
 * for the admin (all of BusHub) and a bus company's manager (their own trips only), so the two
 * always agree. Days are Dhaka calendar days.
 *
 * - A ticket counts on the day it was paid (paidAt, or createdAt for old tickets), a refund on
 *   the day it was refunded, a counter seat on the day it was sold.
 * - Seat fill is for the trips that travel in the range: paid online seats plus counter seats,
 *   over the bus's seats.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
export const MAX_REPORT_DAYS = 400

export type PaymentKey = 'bkash' | 'nagad' | 'card' | 'cash' | 'unknown'
export const PAYMENT_KEYS: PaymentKey[] = ['bkash', 'nagad', 'card', 'cash', 'unknown']

export interface Kpi {
  current: number
  previous: number
  /** Change in percent; null when there was nothing to compare with. For a rate (seat fill,
   * refund rate) it is the change in percentage points instead, so 3.9% → 4.3% reads +0.4. */
  pct: number | null
  /** Set when pct is in percentage points rather than percent. */
  points?: boolean
}

export interface ReportRange {
  from: string
  to: string
  days: number
  prevFrom: string
  prevTo: string
}

export interface Report {
  scope: 'admin' | 'company'
  range: ReportRange
  kpis: {
    /** Tickets bought on BusHub. */
    tickets: Kpi
    /** Seats sold: online, plus the counter for a company. */
    seats: Kpi
    /** Ticket money: online, plus the counter for a company. */
    sales: Kpi
    /** Admin: BusHub's commission. Company: what the company keeps (online payout + counter). */
    earnings: Kpi
    avgTicket: Kpi
    refunds: Kpi
    /** Refunded tickets over paid ones, in percent with one decimal. */
    refundRate: Kpi
    /** Seats filled on the trips that travel in the range, in percent. */
    fill: Kpi
  }
  trend: { date: string; prevDate: string; seats: number; prevSeats: number; money: number; prevMoney: number }[]
  routes: { from: string; to: string; seats: number; money: number; fill: number | null }[]
  companies: { id: string; name: string; tickets: number; seats: number; money: number; commission: number; fill: number | null; refundRate: number | null; rating: number | null; ratings: number }[]
  buses: { name: string; trips: number; seats: number; capacity: number; fill: number | null; money: number }[]
  payment: { method: PaymentKey; count: number; money: number }[]
  channel: { online: { seats: number; money: number }; counter: { seats: number; money: number } }
  hours: number[]
  weekdays: number[]
  leadTime: { label: string; tickets: number }[]
  rating: { avg: number | null; count: number }
  /** Upcoming trips in the next 7 days with the most empty seats. */
  lowFill: { busName: string; from: string; to: string; date: string; departureTime: string; sold: number; total: number }[]
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/** The range asked for, checked: a bad one is refused (null); a too-long one is cut to 400 days. */
export function reportRange(fromIn: unknown, toIn: unknown, now = new Date()): ReportRange | null {
  const today = dhakaDate(now)
  const to = toIn === undefined || toIn === null || toIn === '' ? today : toIn
  const from = fromIn === undefined || fromIn === null || fromIn === '' ? addDays(isDate(to) ? to : today, -29) : fromIn
  if (!isDate(from) || !isDate(to) || from > to) return null
  const start = daysBetween(from, to) + 1 > MAX_REPORT_DAYS ? addDays(to, -(MAX_REPORT_DAYS - 1)) : from
  const days = daysBetween(start, to) + 1
  return { from: start, to, days, prevFrom: addDays(start, -days), prevTo: addDays(start, -1) }
}

function kpi(current: number, previous: number): Kpi {
  return { current, previous, pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null }
}

/** A rate against the one before, as the difference in percentage points. */
function rateKpi(current: number, previous: number): Kpi {
  return { current, previous, pct: Math.round((current - previous) * 10) / 10, points: true }
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : null)
const saleTime = (b: { paidAt?: string; createdAt?: string }) => b.paidAt || b.createdAt || ''
const dayOf = (iso: string) => (iso ? dhakaDate(new Date(iso)) : '')
const dhakaParts = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + DHAKA_OFFSET_MS)
  return { hour: d.getUTCHours(), weekday: d.getUTCDay() }
}

const LEAD = [
  { label: 'Same day', max: 0 },
  { label: '1 day before', max: 1 },
  { label: '2–3 days before', max: 3 },
  { label: '4–7 days before', max: 7 },
  { label: '8+ days before', max: Infinity },
]

interface BookingRow {
  busId: string
  status: string
  paymentStatus: string
  totalPrice?: number
  commissionAmount?: number
  companyPayout?: number
  seats?: string[]
  createdAt?: string
  paidAt?: string
  refundedAt?: string
  paymentMethod?: string
  date?: string
  from?: string
  to?: string
}

interface TripRow {
  _id: ObjectId
  companyId?: string
  busName?: string
  fleetId?: string
  from: string
  to: string
  date: string
  departureTime?: string
  price?: number
  totalSeats?: number
  blockedSeats?: string[]
}

/**
 * Build the report. With a companyId only that company's trips, tickets and counter sales are
 * read; without one it is the admin's view of all of BusHub.
 */
export async function buildReport(db: Db, range: ReportRange, companyId?: string, now = new Date()): Promise<Report> {
  const scope: Report['scope'] = companyId ? 'company' : 'admin'
  const start = startOfDhakaDay(range.prevFrom).toISOString()
  const curStart = startOfDhakaDay(range.from).toISOString()
  const end = new Date(startOfDhakaDay(range.to).getTime() + DAY_MS).toISOString()
  // A ticket's hold is made minutes before it is paid; reading two days earlier catches every
  // ticket paid in the range whose hold began just before it.
  const createdFrom = new Date(Date.parse(start) - 2 * DAY_MS).toISOString()

  const companyBusIds = companyId
    ? (await db.collection('buses').find({ companyId }, { projection: { _id: 1 } }).toArray()).map((b) => b._id.toString())
    : null
  const busScope = companyBusIds ? { busId: { $in: companyBusIds } } : {}
  const projection = { busId: 1, status: 1, paymentStatus: 1, totalPrice: 1, commissionAmount: 1, companyPayout: 1, seats: 1, createdAt: 1, paidAt: 1, refundedAt: 1, paymentMethod: 1, date: 1, from: 1, to: 1 }

  const [sold, refunded, trips, counterSales, counterTickets, reviews, companies] = await Promise.all([
    db
      .collection<BookingRow>('bookings')
      .find({ ...busScope, paymentStatus: 'paid', status: { $in: ['confirmed', 'refunded'] }, createdAt: { $gte: createdFrom, $lt: end } }, { projection })
      .toArray(),
    db
      .collection<BookingRow>('bookings')
      .find({ ...busScope, status: 'refunded', refundedAt: { $gte: start, $lt: end } }, { projection })
      .toArray(),
    db
      .collection<TripRow>('buses')
      .find(
        { ...(companyId ? { companyId } : {}), status: { $ne: 'cancelled' }, date: { $gte: range.prevFrom, $lte: addDays(dhakaDate(now), 7) > range.to ? addDays(dhakaDate(now), 7) : range.to } },
        { projection: { companyId: 1, busName: 1, fleetId: 1, from: 1, to: 1, date: 1, departureTime: 1, price: 1, totalSeats: 1, blockedSeats: 1 } }
      )
      .toArray(),
    db
      .collection<{ busId: string; fare?: number | null; soldAt: string; ticketCode?: string }>('counterSales')
      .find({ ...(companyId ? { companyId } : {}), soldAt: { $gte: start, $lt: end } }, { projection: { busId: 1, fare: 1, soldAt: 1, ticketCode: 1, companyId: 1 } })
      .toArray(),
    db
      .collection<{ paymentMethod?: string; total?: number; soldAt: string }>('counterTickets')
      .find({ ...(companyId ? { companyId } : {}), status: 'sold', soldAt: { $gte: start, $lt: end } }, { projection: { paymentMethod: 1, total: 1, soldAt: 1 } })
      .toArray(),
    db
      .collection<{ companyName?: string; rating?: number; companyRating?: number }>('reviews')
      .find({ hidden: { $ne: true } }, { projection: { companyName: 1, rating: 1, companyRating: 1 } })
      .toArray(),
    db
      .collection('companies')
      .find(companyId ? { _id: ObjectId.isValid(companyId) ? new ObjectId(companyId) : new ObjectId() } : {}, { projection: { name: 1 } })
      .toArray() as Promise<{ _id: ObjectId; name?: string }[]>,
  ])

  // Trips the counter seats and tickets belong to, which may travel outside the range.
  const tripById = new Map(trips.map((t) => [t._id.toString(), t]))
  const missing = Array.from(new Set([...sold, ...refunded].map((b) => b.busId).concat(counterSales.map((c) => String(c.busId))))).filter(
    (id) => !tripById.has(id) && ObjectId.isValid(id)
  )
  if (missing.length) {
    const more = await db
      .collection<TripRow>('buses')
      .find({ _id: { $in: missing.map((id) => new ObjectId(id)) } }, { projection: { companyId: 1, busName: 1, fleetId: 1, from: 1, to: 1, date: 1, departureTime: 1, price: 1, totalSeats: 1, blockedSeats: 1 } })
      .toArray()
    for (const t of more) tripById.set(t._id.toString(), t)
  }

  const inCur = (iso: string) => iso >= curStart && iso < end
  const inPrev = (iso: string) => iso >= start && iso < curStart
  const paidNow = sold.filter((b) => b.status === 'confirmed' || b.status === 'refunded').filter((b) => inCur(saleTime(b)) || inPrev(saleTime(b)))
  // A refunded ticket was a sale on the day it was paid; it leaves the sales the day it is refunded.
  const sales = paidNow.filter((b) => b.status === 'confirmed')
  const cur = sales.filter((b) => inCur(saleTime(b)))
  const prev = sales.filter((b) => inPrev(saleTime(b)))
  const refundsCur = refunded.filter((b) => inCur(b.refundedAt || ''))
  const refundsPrev = refunded.filter((b) => inPrev(b.refundedAt || ''))
  const paidCur = paidNow.filter((b) => inCur(saleTime(b))).length
  const paidPrev = paidNow.filter((b) => inPrev(saleTime(b))).length

  const counterMoney = (c: { busId: unknown; fare?: number | null }) => (typeof c.fare === 'number' ? c.fare : tripById.get(String(c.busId))?.price || 0)
  const counterCur = counterSales.filter((c) => inCur(String(c.soldAt)))
  const counterPrev = counterSales.filter((c) => inPrev(String(c.soldAt)))
  const withCounter = scope === 'company'

  const sum = <T>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + (f(x) || 0), 0)
  const seatsOf = (b: BookingRow) => (b.seats || []).length
  const seatsCur = sum(cur, seatsOf) + (withCounter ? counterCur.length : 0)
  const seatsPrev = sum(prev, seatsOf) + (withCounter ? counterPrev.length : 0)
  const salesCur = sum(cur, (b) => b.totalPrice || 0) + (withCounter ? sum(counterCur, counterMoney) : 0)
  const salesPrev = sum(prev, (b) => b.totalPrice || 0) + (withCounter ? sum(counterPrev, counterMoney) : 0)
  const earn = (list: BookingRow[], counter: typeof counterSales) =>
    withCounter ? sum(list, (b) => b.companyPayout ?? (b.totalPrice || 0) - (b.commissionAmount || 0)) + sum(counter, counterMoney) : sum(list, (b) => b.commissionAmount || 0)

  // Seat fill: trips travelling in each period, online seats paid on them plus counter seats.
  const tripsCur = trips.filter((t) => t.date >= range.from && t.date <= range.to)
  const tripsPrev = trips.filter((t) => t.date >= range.prevFrom && t.date <= range.prevTo)
  const fillIds = [...tripsCur, ...tripsPrev, ...trips.filter((t) => t.date > dhakaDate(now))].map((t) => t._id.toString())
  const onlineSeatsByTrip = new Map<string, number>()
  if (fillIds.length) {
    const onTrips = await db
      .collection<BookingRow>('bookings')
      .find({ busId: { $in: fillIds }, paymentStatus: 'paid', status: 'confirmed' }, { projection: { busId: 1, seats: 1 } })
      .toArray()
    for (const b of onTrips) onlineSeatsByTrip.set(b.busId, (onlineSeatsByTrip.get(b.busId) || 0) + seatsOf(b))
  }
  const soldOn = (t: TripRow) => (onlineSeatsByTrip.get(t._id.toString()) || 0) + (t.blockedSeats || []).length
  const fillOf = (list: TripRow[]) => pct(sum(list, soldOn), sum(list, (t) => t.totalSeats || 0))

  // Trend: day i of this period against day i of the one before.
  const dayIndex = new Map<string, number>()
  const trend = Array.from({ length: range.days }, (_, i) => {
    dayIndex.set(addDays(range.from, i), i)
    return { date: addDays(range.from, i), prevDate: addDays(range.prevFrom, i), seats: 0, prevSeats: 0, money: 0, prevMoney: 0 }
  })
  const prevIndex = (day: string) => daysBetween(range.prevFrom, day)
  const addTrend = (iso: string, seats: number, money: number) => {
    const day = dayOf(iso)
    const i = dayIndex.get(day)
    if (i !== undefined) {
      trend[i].seats += seats
      trend[i].money += money
      return
    }
    const p = prevIndex(day)
    if (p >= 0 && p < range.days) {
      trend[p].prevSeats += seats
      trend[p].prevMoney += money
    }
  }
  for (const b of [...cur, ...prev]) addTrend(saleTime(b), seatsOf(b), b.totalPrice || 0)
  if (withCounter) for (const c of [...counterCur, ...counterPrev]) addTrend(String(c.soldAt), 1, counterMoney(c))

  // Routes, by seats sold in the range (online, plus the counter for a company).
  const routes = new Map<string, { from: string; to: string; seats: number; money: number }>()
  const addRoute = (from: string | undefined, to: string | undefined, seats: number, money: number) => {
    if (!from || !to) return
    const key = `${from}→${to}`
    const r = routes.get(key) || { from, to, seats: 0, money: 0 }
    r.seats += seats
    r.money += money
    routes.set(key, r)
  }
  for (const b of cur) addRoute(b.from || tripById.get(b.busId)?.from, b.to || tripById.get(b.busId)?.to, seatsOf(b), b.totalPrice || 0)
  if (withCounter) for (const c of counterCur) addRoute(tripById.get(String(c.busId))?.from, tripById.get(String(c.busId))?.to, 1, counterMoney(c))
  const routeFill = (from: string, to: string) => fillOf(tripsCur.filter((t) => t.from === from && t.to === to))

  // Payment: online tickets by how they were paid, counter tickets by cash/bKash/Nagad.
  const pay = new Map<PaymentKey, { count: number; money: number }>(PAYMENT_KEYS.map((k) => [k, { count: 0, money: 0 }]))
  const addPay = (method: string | undefined, money: number) => {
    const key: PaymentKey = method && (PAYMENT_KEYS as string[]).includes(method) ? (method as PaymentKey) : 'unknown'
    const p = pay.get(key)!
    p.count += 1
    p.money += money
  }
  for (const b of cur) addPay(b.paymentMethod, b.totalPrice || 0)
  if (withCounter) {
    for (const t of counterTickets.filter((t) => inCur(String(t.soldAt)))) addPay(t.paymentMethod, t.total || 0)
    for (const c of counterCur.filter((c) => !c.ticketCode)) addPay(undefined, counterMoney(c))
  }

  // When people buy, and how long before they travel.
  const hours = Array(24).fill(0)
  const weekdays = Array(7).fill(0)
  const leadTime = LEAD.map((l) => ({ label: l.label, tickets: 0 }))
  for (const b of cur) {
    const { hour, weekday } = dhakaParts(saleTime(b))
    hours[hour] += 1
    weekdays[weekday] += 1
    if (b.date) {
      const ahead = Math.max(0, daysBetween(dayOf(saleTime(b)), b.date))
      leadTime[LEAD.findIndex((l) => ahead <= l.max)].tickets += 1
    }
  }
  // Counter sales count once per ticket, like online ones (a family's 3 seats are one sale);
  // seats sold before counter tickets existed count one each.
  if (withCounter)
    for (const iso of [...counterTickets.filter((t) => inCur(String(t.soldAt))).map((t) => String(t.soldAt)), ...counterCur.filter((c) => !c.ticketCode).map((c) => String(c.soldAt))]) {
      const { hour, weekday } = dhakaParts(iso)
      hours[hour] += 1
      weekdays[weekday] += 1
    }

  // Ratings by company name (reviews carry the name, not the id). Bus companies by their own stars (an older review's one rating counts for both); BusHub by
  // its own rating. No combined score.
  const ratingBy = new Map<string, { total: number; count: number }>()
  const bushubRating = { total: 0, count: 0 }
  for (const r of reviews) {
    const key = String(r.companyName || '')
    const g = ratingBy.get(key) || { total: 0, count: 0 }
    g.total += Number(r.companyRating ?? r.rating) || 0
    g.count += 1
    ratingBy.set(key, g)
    bushubRating.total += Number(r.rating) || 0
    bushubRating.count += 1
  }
  const avgRating = (g?: { total: number; count: number }) => (g && g.count ? Math.round((g.total / g.count) * 10) / 10 : null)
  const nameOf = new Map(companies.map((c) => [c._id.toString(), c.name || 'Bus company']))

  // Admin: one row per company.
  const companyRows: Report['companies'] = []
  if (scope === 'admin') {
    const rows = new Map<string, Report['companies'][number] & { paid: number; refunded: number }>()
    const rowFor = (id: string) => {
      let r = rows.get(id)
      if (!r) {
        r = { id, name: nameOf.get(id) || 'Bus company', tickets: 0, seats: 0, money: 0, commission: 0, fill: null, refundRate: null, rating: null, ratings: 0, paid: 0, refunded: 0 }
        rows.set(id, r)
      }
      return r
    }
    for (const b of cur) {
      const id = tripById.get(b.busId)?.companyId
      if (!id) continue
      const r = rowFor(id)
      r.tickets += 1
      r.seats += seatsOf(b)
      r.money += b.totalPrice || 0
      r.commission += b.commissionAmount || 0
    }
    for (const b of paidNow.filter((b) => inCur(saleTime(b)))) {
      const id = tripById.get(b.busId)?.companyId
      if (id) rowFor(id).paid += 1
    }
    for (const b of refundsCur) {
      const id = tripById.get(b.busId)?.companyId
      if (id) rowFor(id).refunded += 1
    }
    for (const t of tripsCur) if (t.companyId) rowFor(t.companyId)
    for (const r of Array.from(rows.values())) {
      r.fill = fillOf(tripsCur.filter((t) => t.companyId === r.id))
      r.refundRate = pct(r.refunded, r.paid)
      const g = ratingBy.get(r.name)
      r.rating = avgRating(g)
      r.ratings = g?.count || 0
      const { paid: _paid, refunded: _refunded, ...row } = r
      companyRows.push(row)
    }
    companyRows.sort((a, b) => b.money - a.money || b.seats - a.seats)
  }

  // Company: one row per bus in its fleet, for the trips travelling in the range.
  const busRows: Report['buses'] = []
  if (scope === 'company') {
    const byBus = new Map<string, TripRow[]>()
    for (const t of tripsCur) {
      const key = t.fleetId || t.busName || 'Bus'
      byBus.set(key, [...(byBus.get(key) || []), t])
    }
    const onlineMoneyByTrip = new Map<string, number>()
    for (const b of sales) onlineMoneyByTrip.set(b.busId, (onlineMoneyByTrip.get(b.busId) || 0) + (b.totalPrice || 0))
    for (const list of Array.from(byBus.values())) {
      const ids = new Set(list.map((t) => t._id.toString()))
      busRows.push({
        name: list[0].busName || 'Bus',
        trips: list.length,
        seats: sum(list, soldOn),
        capacity: sum(list, (t) => t.totalSeats || 0),
        fill: fillOf(list),
        money: sum(list, (t) => onlineMoneyByTrip.get(t._id.toString()) || 0) + sum(counterSales.filter((c) => ids.has(String(c.busId))), counterMoney),
      })
    }
    busRows.sort((a, b) => (b.fill ?? -1) - (a.fill ?? -1))
  }

  const today = dhakaDate(now)
  const lowFill = trips
    .filter((t) => t.date > today && t.date <= addDays(today, 7) && (t.totalSeats || 0) > 0)
    .map((t) => ({ busName: t.busName || 'Bus', from: t.from, to: t.to, date: t.date, departureTime: t.departureTime || '', sold: soldOn(t), total: t.totalSeats || 0 }))
    .sort((a, b) => a.sold / a.total - b.sold / b.total || a.date.localeCompare(b.date))
    .slice(0, 5)

  const ownRating = scope === 'company' ? ratingBy.get(nameOf.get(companyId!) || '') : undefined

  return {
    scope,
    range,
    kpis: {
      tickets: kpi(cur.length, prev.length),
      seats: kpi(seatsCur, seatsPrev),
      sales: kpi(salesCur, salesPrev),
      earnings: kpi(earn(cur, counterCur), earn(prev, counterPrev)),
      avgTicket: kpi(cur.length ? Math.round(sum(cur, (b) => b.totalPrice || 0) / cur.length) : 0, prev.length ? Math.round(sum(prev, (b) => b.totalPrice || 0) / prev.length) : 0),
      refunds: kpi(refundsCur.length, refundsPrev.length),
      refundRate: rateKpi(pct(refundsCur.length, paidCur) ?? 0, pct(refundsPrev.length, paidPrev) ?? 0),
      fill: rateKpi(fillOf(tripsCur) ?? 0, fillOf(tripsPrev) ?? 0),
    },
    trend,
    routes: Array.from(routes.values())
      .sort((a, b) => b.seats - a.seats || b.money - a.money)
      .slice(0, 10)
      .map((r) => ({ ...r, fill: routeFill(r.from, r.to) })),
    companies: companyRows,
    buses: busRows,
    payment: PAYMENT_KEYS.map((method) => ({ method, ...pay.get(method)! })),
    channel: {
      online: { seats: sum(cur, seatsOf), money: sum(cur, (b) => b.totalPrice || 0) },
      counter: { seats: counterCur.length, money: sum(counterCur, counterMoney) },
    },
    hours,
    weekdays,
    leadTime,
    rating: scope === 'company' ? { avg: avgRating(ownRating), count: ownRating?.count || 0 } : { avg: avgRating(bushubRating), count: bushubRating.count },
    lowFill,
  }
}
