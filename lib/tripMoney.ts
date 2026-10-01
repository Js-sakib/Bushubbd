/**
 * Money per trip, the same sums for the company manager and the BusHub admin: tickets sold on
 * BusHub (what passengers paid, BusHub's fee and what the company gets), seats sold at the
 * counter (full ticket price, no fee), the costs the bus staff entered, and what is left.
 * No database code here, so the pages can use it too.
 */

export const COST_TYPES = ['fuel', 'road', 'toll', 'other'] as const
export type CostType = (typeof COST_TYPES)[number]

export const COST_LABELS: Record<CostType, { en: string; bn: string }> = {
  fuel: { en: 'Fuel', bn: 'তেল' },
  road: { en: 'Road', bn: 'রাস্তা খরচ' },
  toll: { en: 'Toll', bn: 'টোল' },
  other: { en: 'Other', bn: 'অন্যান্য' },
}

/** One cost a bus staff member or the manager entered for a trip. */
export interface TripCost {
  _id: string
  busId: string
  type: CostType
  amount: number
  note: string
  addedBy: string
  staffId: string | null
  role: 'manager' | 'scanner'
  createdAt: string
}

/** The largest single cost entry, in taka: a typo guard, not a business rule. */
export const MAX_COST_AMOUNT = 500_000
export const MAX_COSTS_PER_TRIP = 60

export interface MoneyInput {
  price: number
  totalSeats: number
  /** Seats sold at the counter. */
  counterSeats: number
  /** Paid BusHub tickets on this trip. */
  online: { seats: number; total: number; payout: number }[]
  /** Held right now by someone paying online; not sold, not free either. */
  heldSeats?: number
  costs: { type: CostType; amount: number }[]
}

export interface TripMoney {
  seats: { total: number; online: number; counter: number; held: number; notSold: number }
  online: { tickets: number; total: number; fee: number; payout: number }
  counter: { seats: number; total: number }
  costs: Record<CostType, number> & { total: number }
  /** Every taka passengers paid for this trip: BusHub tickets in full plus counter tickets. */
  ticketMoney: number
  /** What the company receives: counter money plus BusHub's payout. */
  companyGets: number
  /** What the company keeps after the trip's costs. */
  left: number
}

export function tripMoney(input: MoneyInput): TripMoney {
  const onlineSeats = input.online.reduce((n, t) => n + t.seats, 0)
  const onlineTotal = input.online.reduce((n, t) => n + (t.total || 0), 0)
  const payout = input.online.reduce((n, t) => n + (t.payout || 0), 0)
  const counterTotal = input.counterSeats * (input.price || 0)
  const costs = { fuel: 0, road: 0, toll: 0, other: 0, total: 0 }
  for (const c of input.costs) {
    const type = COST_TYPES.includes(c.type) ? c.type : 'other'
    costs[type] += c.amount || 0
    costs.total += c.amount || 0
  }
  const held = input.heldSeats || 0
  const companyGets = counterTotal + payout
  return {
    seats: {
      total: input.totalSeats,
      online: onlineSeats,
      counter: input.counterSeats,
      held,
      notSold: Math.max(0, input.totalSeats - onlineSeats - input.counterSeats - held),
    },
    online: { tickets: input.online.length, total: onlineTotal, fee: onlineTotal - payout, payout },
    counter: { seats: input.counterSeats, total: counterTotal },
    costs,
    ticketMoney: onlineTotal + counterTotal,
    companyGets,
    left: companyGets - costs.total,
  }
}

/** Adds trips' money together for a bus, a company or a period. */
export function addMoney(list: TripMoney[]): TripMoney {
  const sum = tripMoney({ price: 0, totalSeats: 0, counterSeats: 0, online: [], costs: [] })
  for (const m of list) {
    for (const k of Object.keys(sum.seats) as (keyof TripMoney['seats'])[]) sum.seats[k] += m.seats[k]
    for (const k of Object.keys(sum.online) as (keyof TripMoney['online'])[]) sum.online[k] += m.online[k]
    for (const k of Object.keys(sum.counter) as (keyof TripMoney['counter'])[]) sum.counter[k] += m.counter[k]
    for (const k of Object.keys(sum.costs) as (keyof TripMoney['costs'])[]) sum.costs[k] += m.costs[k]
    sum.ticketMoney += m.ticketMoney
    sum.companyGets += m.companyGets
    sum.left += m.left
  }
  return sum
}

export const taka = (n: number) => `${n < 0 ? '−' : ''}৳${Math.abs(Math.round(n)).toLocaleString('en-US')}`
