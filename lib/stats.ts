import { dhakaDate, lastDhakaDays } from './scan'

export interface SaleRecord {
  paymentStatus: string
  status: string
  totalPrice?: number
  commissionAmount?: number
  companyPayout?: number
  companyName?: string
  seats?: string[]
  createdAt?: string
  refundedAt?: string
  date?: string
  checkedIn?: boolean
  source?: string
}

export interface DayTotals {
  date: string
  tickets: number
  revenue: number
  commission: number
  refunds: number
}

export interface Delta {
  current: number
  previous: number
  /** Percent change against the previous seven days; null when there is nothing to compare with. */
  pct: number | null
}

/** Companies past this many fold into "Other", so the chart never needs a new colour. */
const TOP_COMPANIES = 6

function isSold(b: SaleRecord): boolean {
  return b.paymentStatus === 'paid' && b.status === 'confirmed'
}

function delta(current: number, previous: number): Delta {
  return { current, previous, pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null }
}

/**
 * Everything the admin dashboard shows, computed over every booking rather than the latest
 * page of them. Days are Dhaka calendar days. A ticket counts on the day it was sold, and a
 * refund on the day it was refunded; "sold" means paid and not refunded.
 */
export function summarizeSales(bookings: SaleRecord[], now: Date = new Date(), days = 14) {
  const series: DayTotals[] = lastDhakaDays(days, now).map((date) => ({
    date,
    tickets: 0,
    revenue: 0,
    commission: 0,
    refunds: 0,
  }))
  const dayIndex = new Map(series.map((d, i) => [d.date, i]))
  const today = dhakaDate(now)

  const totals = { tickets: 0, seats: 0, revenue: 0, commission: 0, owed: 0, refunds: 0, refundedAmount: 0 }
  const companies = new Map<string, { name: string; tickets: number; owed: number }>()
  const boardingToday = { seats: 0, boarded: 0 }
  const channels = { web: 0, whatsapp: 0 }

  for (const b of bookings) {
    const price = b.totalPrice || 0
    if (isSold(b)) {
      totals.tickets += 1
      totals.seats += b.seats?.length || 0
      totals.revenue += price
      totals.commission += b.commissionAmount || 0
      totals.owed += b.companyPayout || 0

      const name = (b.companyName || 'Unknown').trim() || 'Unknown'
      const company = companies.get(name) || { name, tickets: 0, owed: 0 }
      company.tickets += 1
      company.owed += b.companyPayout || 0
      companies.set(name, company)

      if (b.source === 'whatsapp') channels.whatsapp += 1
      else channels.web += 1

      if (b.date === today) {
        boardingToday.seats += b.seats?.length || 0
        if (b.checkedIn) boardingToday.boarded += b.seats?.length || 0
      }

      const i = b.createdAt ? dayIndex.get(dhakaDate(new Date(b.createdAt))) : undefined
      if (i !== undefined) {
        series[i].tickets += 1
        series[i].revenue += price
        series[i].commission += b.commissionAmount || 0
      }
    } else if (b.status === 'refunded') {
      totals.refunds += 1
      totals.refundedAmount += price
      const when = b.refundedAt || b.createdAt
      const i = when ? dayIndex.get(dhakaDate(new Date(when))) : undefined
      if (i !== undefined) series[i].refunds += 1
    }
  }

  const half = Math.floor(days / 2)
  const sum = (from: number, to: number, key: keyof Omit<DayTotals, 'date'>) =>
    series.slice(from, to).reduce((s, d) => s + d[key], 0)
  const weekly = (key: keyof Omit<DayTotals, 'date'>) => delta(sum(days - half, days, key), sum(days - 2 * half, days - half, key))

  const ranked = Array.from(companies.values()).sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name))
  const byCompany = ranked.slice(0, TOP_COMPANIES)
  if (ranked.length > TOP_COMPANIES) {
    const rest = ranked.slice(TOP_COMPANIES)
    byCompany.push({
      name: `Other (${rest.length})`,
      tickets: rest.reduce((s, c) => s + c.tickets, 0),
      owed: rest.reduce((s, c) => s + c.owed, 0),
    })
  }

  return {
    totals,
    series,
    deltas: {
      tickets: weekly('tickets'),
      revenue: weekly('revenue'),
      commission: weekly('commission'),
      refunds: weekly('refunds'),
    },
    byCompany,
    boardingToday,
    channels,
  }
}

export type SalesSummary = ReturnType<typeof summarizeSales>
