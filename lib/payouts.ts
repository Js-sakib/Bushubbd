import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { ObjectId, type Db } from 'mongodb'
import { dhakaDate } from './scan'
import { tripDeparted } from './trips'

/**
 * Paying bus companies what BusHub owes them. The admin makes an invoice of every paid BusHub
 * ticket on the company's trips that have already left, pays it (bKash, bank...) and records the
 * reference; the company's manager checks it and signs it off with their password.
 *
 * Safety:
 * - Each ticket goes into one invoice only: the invoice claims its tickets with one conditional
 *   update before it is written, so two invoices made at once can't both include a ticket.
 * - Every amount comes from the tickets in the database, never from the browser.
 * - An invoice's lines are frozen when it is made; a fingerprint of them is stored and the
 *   manager's sign-off seals that fingerprint with the server's secret, so any later change to
 *   the lines, the amount or the payment reference shows as "changed after signing".
 * - A ticket in an invoice can't be refunded any more.
 */

import type { PayoutStatus } from './payoutText'
export { PAY_METHODS, type PayMethod, type PayoutStatus } from './payoutText'

export interface PayoutLine {
  bookingId: string
  code: string
  passengerName: string
  date: string
  departureTime: string
  from: string
  to: string
  busName: string
  seats: string[]
  /** What the passenger paid. */
  ticketPrice: number
  commissionRate: number
  commission: number
  /** What the company gets for this ticket. */
  payout: number
}

export interface PayoutTotals {
  tickets: number
  seats: number
  ticketTotal: number
  commission: number
  payout: number
}

function secret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-me'
}

/** What BusHub owes for one ticket, also for older tickets saved before the payout field. */
export function ticketLine(b: any): PayoutLine {
  const ticketPrice = Number(b.totalPrice) || 0
  const commission = Number.isFinite(b.commissionAmount) ? Number(b.commissionAmount) : 0
  const payout = Number.isFinite(b.companyPayout) ? Number(b.companyPayout) : ticketPrice - commission
  return {
    bookingId: b._id.toString(),
    code: b.bookingCode,
    passengerName: b.passengerName || '',
    date: b.date,
    departureTime: b.departureTime,
    from: b.from,
    to: b.to,
    busName: b.busName,
    seats: b.seats || [],
    ticketPrice,
    commissionRate: Number(b.commissionRate) || 0,
    commission: ticketPrice - payout,
    payout,
  }
}

export function totalsOf(lines: PayoutLine[]): PayoutTotals {
  return lines.reduce(
    (t, l) => ({
      tickets: t.tickets + 1,
      seats: t.seats + l.seats.length,
      ticketTotal: t.ticketTotal + l.ticketPrice,
      commission: t.commission + l.commission,
      payout: t.payout + l.payout,
    }),
    { tickets: 0, seats: 0, ticketTotal: 0, commission: 0, payout: 0 }
  )
}

/** Trip by trip, oldest first, then by ticket code: the order an invoice lists its lines in. */
function byTrip(a: PayoutLine, b: PayoutLine) {
  return a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime) || a.busName.localeCompare(b.busName) || a.code.localeCompare(b.code)
}

/** The company's departed trips. Tickets are paid out once the bus has left, never before. */
async function departedTripIds(db: Db, companyId: string): Promise<string[]> {
  const trips = await db
    .collection('buses')
    .find({ companyId, date: { $lte: dhakaDate() } })
    .project({ date: 1, departureTime: 1 })
    .toArray()
  return trips.filter((t) => tripDeparted(t.date, t.departureTime)).map((t) => t._id.toString())
}

const OWED_FILTER = { status: 'confirmed', paymentStatus: 'paid', payoutId: { $exists: false } }

/** Paid BusHub tickets on the company's departed trips that no invoice has taken yet. */
export async function owedLines(db: Db, companyId: string): Promise<PayoutLine[]> {
  const ids = await departedTripIds(db, companyId)
  if (ids.length === 0) return []
  const rows = await db.collection('bookings').find({ ...OWED_FILTER, busId: { $in: ids } }).toArray()
  return rows.map(ticketLine).sort(byTrip)
}

/** Paid tickets for trips still to leave: owed later, once the bus has gone. */
export async function upcomingTotals(db: Db, companyId: string): Promise<PayoutTotals> {
  const trips = await db
    .collection('buses')
    .find({ companyId, date: { $gte: dhakaDate() } })
    .project({ date: 1, departureTime: 1 })
    .toArray()
  const ids = trips.filter((t) => !tripDeparted(t.date, t.departureTime)).map((t) => t._id.toString())
  if (ids.length === 0) return totalsOf([])
  const rows = await db.collection('bookings').find({ ...OWED_FILTER, busId: { $in: ids } }).toArray()
  return totalsOf(rows.map(ticketLine))
}

/** The fingerprint of an invoice's frozen content. */
export function contentHash(inv: { number: string; companyId: string; lines: PayoutLine[]; totals: PayoutTotals; createdAt: string }): string {
  return createHash('sha256')
    .update(JSON.stringify([inv.number, inv.companyId, inv.createdAt, inv.totals, inv.lines]))
    .digest('hex')
}

/** The manager's sign-off: the content fingerprint and the payment, sealed with the server secret. */
export function signOff(hash: string, payment: { method: string; reference: string; amount: number }, signedBy: string, at: string): string {
  return createHmac('sha256', secret()).update([hash, payment.method, payment.reference, payment.amount, signedBy, at].join('|')).digest('hex')
}

/** Has anything in the invoice changed since it was made, or since it was signed? */
export function checkInvoice(inv: any): { contentOk: boolean; signatureOk: boolean | null } {
  const hash = contentHash(inv)
  const contentOk = hash === inv.contentHash && totalsOf(inv.lines).payout === inv.totals.payout
  if (!inv.confirmation) return { contentOk, signatureOk: null }
  const expected = signOff(inv.contentHash, inv.payment || {}, inv.confirmation.signedBy, inv.confirmation.at)
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(String(inv.confirmation.signature || ''), 'hex')
  return { contentOk, signatureOk: a.length === b.length && timingSafeEqual(a, b) }
}

/** INV-2026-0001, counting up for good. */
async function nextNumber(db: Db): Promise<string> {
  const year = dhakaDate().slice(0, 4)
  const row = await db
    .collection<{ _id: string; seq: number }>('counters')
    .findOneAndUpdate({ _id: `invoice-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  const seq = (row as any)?.value?.seq ?? (row as any)?.seq ?? 1
  return `INV-${year}-${String(seq).padStart(4, '0')}`
}

/**
 * Makes an invoice of everything owed to the company right now. Returns null when nothing is
 * owed. The tickets are claimed first, so a ticket can only ever be in one invoice.
 */
export async function createInvoice(db: Db, companyId: string, companyName: string) {
  const owed = await owedLines(db, companyId)
  if (owed.length === 0) return null
  const _id = new ObjectId()
  const payoutId = _id.toString()
  await db
    .collection('bookings')
    .updateMany({ _id: { $in: owed.map((l) => new ObjectId(l.bookingId)) }, ...OWED_FILTER }, { $set: { payoutId } })
  const claimed = (await db.collection('bookings').find({ payoutId }).toArray()).map(ticketLine).sort(byTrip)
  if (claimed.length === 0) return null
  try {
    const createdAt = new Date().toISOString()
    const number = await nextNumber(db)
    const totals = totalsOf(claimed)
    const doc = {
      _id,
      number,
      companyId,
      companyName,
      lines: claimed,
      totals,
      from: claimed[0].date,
      to: claimed[claimed.length - 1].date,
      status: 'unpaid' as PayoutStatus,
      createdAt,
      contentHash: contentHash({ number, companyId, lines: claimed, totals, createdAt }),
      history: [{ at: createdAt, by: 'BusHub admin', event: 'Invoice made' }],
    }
    await db.collection('payouts').insertOne(doc)
    return doc
  } catch (err) {
    await db.collection('bookings').updateMany({ payoutId }, { $unset: { payoutId: '' } })
    throw err
  }
}

/** What the lists show: no ticket lines. */
export function invoiceSummary(inv: any) {
  return {
    _id: inv._id.toString(),
    number: inv.number,
    companyId: inv.companyId,
    companyName: inv.companyName,
    from: inv.from,
    to: inv.to,
    totals: inv.totals,
    status: inv.status as PayoutStatus,
    createdAt: inv.createdAt,
    payment: inv.payment || null,
    confirmation: inv.confirmation ? { signedBy: inv.confirmation.signedBy, at: inv.confirmation.at } : null,
    dispute: inv.dispute || null,
  }
}

/** The whole invoice, with the check that nothing changed. */
export function invoiceFull(inv: any) {
  const check = checkInvoice(inv)
  return {
    ...invoiceSummary(inv),
    lines: inv.lines as PayoutLine[],
    contentHash: inv.contentHash,
    history: inv.history || [],
    check,
  }
}
