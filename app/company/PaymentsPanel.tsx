'use client'

import { useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { matches } from '@/lib/search'
import SearchBox from '../SearchBox'
import { statusOf, type InvoiceSummaryView, type PayoutTotalsView } from '@/lib/payoutText'
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
  const [search, setSearch] = useState('')
  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>
  const toSign = data.invoices.filter((i) => i.status === 'paid')
  const toApprove = data.invoices.filter((i) => i.status === 'unpaid' && !i.approval)
  const received = data.invoices.filter((i) => i.status === 'confirmed').reduce((n, i) => n + i.totals.payout, 0)
  const refunds = data.refunds.reduce((n, r) => n + r.amount, 0)

  return (
    <div className="flex flex-col gap-3">
      {toSign.length > 0 && (
        <a href={`/invoice/${toSign[0]._id}`} className="flex items-center gap-3 rounded-2xl border border-[#60a5fa]/40 bg-[#60a5fa]/[0.1] px-4 py-3">
          <span className="grow text-[13px] font-semibold text-[#1d4ed8]">
            BusHub paid {taka(toSign[0].totals.payout)}. Check the money arrived and tap Done.
          </span>
          <span className="text-[12.5px] font-bold text-[#2563eb]">Open ›</span>
        </a>
      )}
      {toApprove.length > 0 && (
        <a href={`/invoice/${toApprove[0]._id}`} className="flex items-center gap-3 rounded-2xl border border-[#cc8b65]/40 bg-[#feb249]/[0.08] px-4 py-3">
          <span className="grow text-[13px] font-semibold text-[#8a6d00]">
            {toApprove.length === 1 ? `Invoice ${toApprove[0].number} (${taka(toApprove[0].totals.payout)}) needs your approval.` : `${toApprove.length} invoices need your approval.`}
          </span>
          <span className="text-[12.5px] font-bold text-[#8a6d00]">Review ›</span>
        </a>
      )}

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      <div className="card-2 flex flex-col gap-2.5 px-4 py-4">
        <span className="label-xs">BusHub owes you · after commission</span>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13.5px] font-bold">For trips that have left</span>
            {data.owed.tickets > 0 && (
              <span className="text-[11.5px] text-[#555555]">
                Not invoiced yet: {data.owed.tickets} tickets · {data.owed.seats} seats · {taka(data.owed.payout)}
              </span>
            )}
            {data.invoiced > 0 && <span className="text-[11.5px] text-[#555555]">On invoices waiting for payment: {taka(data.invoiced)}</span>}
            {data.owed.tickets === 0 && data.invoiced === 0 && <span className="text-[11.5px] text-[#555555]">Nothing waiting</span>}
          </div>
          <span className="shrink-0 text-[17px] font-bold text-[#0b7f8c]">{taka(data.owed.payout + data.invoiced)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13px] text-[#222222]">For trips still to leave</span>
            <span className="text-[11.5px] text-[#555555]">Paid out after the bus leaves</span>
          </div>
          <span className="shrink-0 text-[14px] font-bold text-[#222222]">{taka(data.later.payout)}</span>
        </div>
        {refunds > 0 && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-[#222222]">Refunds taken back</span>
              <span className="text-[11.5px] text-[#555555]">Comes off your next payment</span>
            </div>
            <span className="shrink-0 text-[14px] font-bold text-[#c13b3b]">−{taka(refunds)}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 border-t border-[#111111]/10 pt-2.5">
          <span className="text-[13px] text-[#222222]">Received and signed so far</span>
          <span className="shrink-0 text-[14px] font-bold text-[#0a8a84]">{taka(received)}</span>
        </div>
      </div>

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#c9d6e4] px-4 py-3">
          <span className="label-xs">Invoices from BusHub</span>
        </div>
        {data.invoices.length > 3 && (
          <div className="border-b border-[#c9d6e4] px-3 py-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search invoice number, date, status" />
          </div>
        )}
        {data.invoices
          .filter((i) => matches(search, i.number, i.from, i.to, formatTripDate(i.from), formatTripDate(i.to), statusOf(i).label, i.totals.payout))
          .map((i) => (
          <a key={i._id} href={`/invoice/${i._id}`} className="flex items-start gap-3 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0 hover:bg-[#111111]/[0.05]">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="font-mono text-[13px] font-bold">{i.number}</span>
              <span className="text-[11.5px] text-[#3f3f3f]">
                {range(i.from, i.to)} · {i.totals.tickets} tickets · {i.totals.seats} seats
              </span>
              <span className={`self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusOf(i).dark}`}>{statusOf(i).label}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[14px] font-bold">{taka(i.totals.payout)}</span>
              {i.status === 'unpaid' && !i.approval ? (
                <span className="rounded-full bg-[#53d3d1] px-3 py-1 text-[11.5px] font-bold text-[#002447]">Review & approve</span>
              ) : i.status === 'paid' ? (
                <span className="rounded-full bg-[#60a5fa] px-3 py-1 text-[11.5px] font-bold text-[#ffffff]">Done ›</span>
              ) : (
                <span className="text-[10.5px] text-[#0b7f8c]">Open ›</span>
              )}
            </div>
          </a>
        ))}
        {data.invoices.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No invoices yet. BusHub makes one when it pays you.</div>}
      </div>
      </div>
    </div>
  )
}
