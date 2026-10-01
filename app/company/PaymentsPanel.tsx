'use client'

import { formatTripDate } from '@/lib/dates'
import { STATUS_TEXT, type InvoiceSummaryView, type PayoutTotalsView } from '@/lib/payoutText'
import { taka } from '@/lib/tripMoney'

export interface PaymentsData {
  owed: PayoutTotalsView
  later: PayoutTotalsView
  invoiced: number
  invoices: InvoiceSummaryView[]
  refunds: { _id: string; code: string; date: string; from: string; to: string; seats: string[]; amount: number; paidIn: string }[]
}

const range = (from: string, to: string) => (from === to ? formatTripDate(from) : `${formatTripDate(from)} – ${formatTripDate(to)}`)

/**
 * The manager's payments from BusHub: what is owed after commission, and every invoice with its
 * tickets. A paid invoice waits for the manager to check the money arrived and sign it.
 */
export default function PaymentsPanel({ data }: { data: PaymentsData | null }) {
  if (!data) return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>
  const toSign = data.invoices.filter((i) => i.status === 'paid')
  const received = data.invoices.filter((i) => i.status === 'confirmed').reduce((n, i) => n + i.totals.payout, 0)
  const refunds = data.refunds.reduce((n, r) => n + r.amount, 0)

  return (
    <div className="flex flex-col gap-3">
      {toSign.length > 0 && (
        <a href={`/invoice/${toSign[0]._id}`} className="flex items-center gap-3 rounded-2xl border border-[#60a5fa]/40 bg-[#60a5fa]/[0.1] px-4 py-3">
          <span className="grow text-[13px] font-semibold text-[#bfdbfe]">
            BusHub paid {taka(toSign[0].totals.payout)}. Check the money arrived and sign.
          </span>
          <span className="text-[12.5px] font-bold text-[#93c5fd]">Open ›</span>
        </a>
      )}

      <div className="card-2 flex flex-col gap-2.5 px-4 py-4">
        <span className="label-xs">BusHub owes you · after commission</span>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13.5px] font-bold">For trips that have left</span>
            <span className="text-[11.5px] text-[#78868a]">
              {data.owed.tickets} tickets · {data.owed.seats} seats · price {taka(data.owed.ticketTotal)} · commission {taka(data.owed.commission)}
            </span>
          </div>
          <span className="shrink-0 text-[17px] font-bold text-[#f5a524]">{taka(data.owed.payout + data.invoiced)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13px] text-[#c4cdcf]">For trips still to leave</span>
            <span className="text-[11.5px] text-[#78868a]">Paid out after the bus leaves</span>
          </div>
          <span className="shrink-0 text-[14px] font-bold text-[#c4cdcf]">{taka(data.later.payout)}</span>
        </div>
        {refunds > 0 && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-[#c4cdcf]">Refunds taken back</span>
              <span className="text-[11.5px] text-[#78868a]">Comes off your next payment</span>
            </div>
            <span className="shrink-0 text-[14px] font-bold text-[#fca5a5]">−{taka(refunds)}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 border-t border-white/[0.06] pt-2.5">
          <span className="text-[13px] text-[#c4cdcf]">Received and signed so far</span>
          <span className="shrink-0 text-[14px] font-bold text-[#34d399]">{taka(received)}</span>
        </div>
      </div>

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#1a2123] px-4 py-3">
          <span className="label-xs">Invoices from BusHub</span>
        </div>
        {data.invoices.map((i) => (
          <a key={i._id} href={`/invoice/${i._id}`} className="flex items-start gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0 hover:bg-white/[0.03]">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="font-mono text-[13px] font-bold">{i.number}</span>
              <span className="text-[11.5px] text-[#9ba7aa]">
                {range(i.from, i.to)} · {i.totals.tickets} tickets · {i.totals.seats} seats
              </span>
              <span className={`self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TEXT[i.status].dark}`}>{STATUS_TEXT[i.status].label}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-[14px] font-bold">{taka(i.totals.payout)}</span>
              <span className="text-[10.5px] text-[#f5a524]">Open ›</span>
            </div>
          </a>
        ))}
        {data.invoices.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No invoices yet. BusHub makes one when it pays you.</div>}
      </div>
    </div>
  )
}
