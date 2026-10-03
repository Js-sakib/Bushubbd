'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { statusOf, type InvoiceSummaryView, type PayoutTotalsView } from '@/lib/payoutText'
import { taka } from '@/lib/tripMoney'
import SearchBox from '../SearchBox'
import { matches } from '@/lib/search'

interface CompanyOwed {
  _id: string
  name: string
  status: string
  owed: PayoutTotalsView
  later: PayoutTotalsView
  invoiced: number
  /** Refunds the company owes back, taken from its next payment. */
  refunds: number
}

const range = (from: string, to: string) => (from === to ? formatTripDate(from) : `${formatTripDate(from)} – ${formatTripDate(to)}`)

/**
 * What BusHub owes each bus company after commission, and the invoices: make one for everything
 * owed now (tickets on trips that have left), open it to pay and record the reference, then the
 * company signs it.
 */
export default function PayoutsPanel() {
  const [data, setData] = useState<{ companies: CompanyOwed[]; invoices: InvoiceSummaryView[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    fetch('/api/admin/payouts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.companies && setData(d))
      .catch(() => undefined)
  }, [])
  useEffect(() => load(), [load])

  const makeInvoice = async (c: CompanyOwed) => {
    if (!confirm(`Make an invoice for ${c.name}: ${c.owed.tickets} tickets, ${taka(c.owed.payout)} to pay?`)) return
    setBusy(c._id)
    const res = await fetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: c._id }) }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setBusy(null)
    if (!res?.ok) return toast.error(json?.error || 'Could not make the invoice')
    window.location.href = `/invoice/${json.invoice._id}?as=admin`
  }

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>

  const owedNow = data.companies.reduce((n, c) => n + Math.max(0, c.owed.payout + c.invoiced - c.refunds), 0)
  const later = data.companies.reduce((n, c) => n + c.later.payout, 0)
  const toSign = data.invoices.filter((i) => i.status === 'paid').length
  const companies = data.companies.filter((c) => (c.owed.tickets > 0 || c.invoiced > 0 || c.later.tickets > 0 || c.refunds > 0) && matches(search, c.name))
  const invoices = data.invoices.filter((i) => matches(search, i.number, i.companyName, i.from, i.to, formatTripDate(i.from), formatTripDate(i.to), statusOf(i).label))

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
      <SearchBox value={search} onChange={setSearch} placeholder="Search company, invoice number, date, status" className="lg:col-span-2" />
      <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-[18px] bg-gradient-to-br from-[#c77a0e] to-[#a25f06] p-3.5">
          <span className="text-[11px] font-bold text-[#fae3bc]">To pay now</span>
          <span className="display text-[22px] font-bold leading-tight text-white">{taka(owedNow)}</span>
          <span className="text-[10.5px] text-[#fae3bc]">Trips that have left</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[18px] bg-gradient-to-br from-[#2f5bc4] to-[#24479b] p-3.5">
          <span className="text-[11px] font-bold text-[#dbe6ff]">Owed later</span>
          <span className="display text-[22px] font-bold leading-tight text-white">{taka(later)}</span>
          <span className="text-[10.5px] text-[#dbe6ff]">Trips still to leave</span>
        </div>
      </div>
      {toSign > 0 && <p className="px-1 text-[12px] text-[#2563eb]">{toSign} paid invoice{toSign === 1 ? ' is' : 's are'} waiting for the company to sign.</p>}

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#c9d6e4] px-4 py-3">
          <span className="label-xs">Each company · after commission</span>
        </div>
        {companies.map((c) => (
          <div key={c._id} className="flex flex-col gap-2.5 border-b border-[#c9d6e4] px-4 py-3.5 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-bold">{c.name}</span>
                <span className="text-[11.5px] text-[#3f3f3f]">
                  {c.owed.tickets} ticket{c.owed.tickets === 1 ? '' : 's'} · {c.owed.seats} seats · price {taka(c.owed.ticketTotal)} · commission {taka(c.owed.commission)}
                </span>
                {c.invoiced > 0 && <span className="text-[11.5px] text-[#8a6d00]">Already invoiced, not paid: {taka(c.invoiced)}</span>}
                {c.later.tickets > 0 && <span className="text-[11.5px] text-[#5e5e5e]">Later: {taka(c.later.payout)} for trips still to leave</span>}
                {c.refunds > 0 && <span className="text-[11.5px] text-[#c13b3b]">Refunds to take back: −{taka(c.refunds)} (from the next payment)</span>}
              </div>
              <span className="shrink-0 text-[17px] font-bold text-[#0b7f8c]">{taka(c.owed.payout)}</span>
            </div>
            {c.owed.tickets > 0 && (
              <button type="button" disabled={busy === c._id} onClick={() => makeInvoice(c)} className="glass-btn h-11 text-sm">
                {busy === c._id ? 'Making…' : `Make invoice and pay ${taka(c.owed.payout)}`}
              </button>
            )}
          </div>
        ))}
        {companies.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">Nothing owed to any company.</div>}
      </div>

      </div>

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#c9d6e4] px-4 py-3">
          <span className="label-xs">Invoices</span>
        </div>
        {invoices.map((i) => (
          <a key={i._id} href={`/invoice/${i._id}?as=admin`} className="flex items-start gap-3 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0 hover:bg-[#111111]/[0.05]">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-bold">
                <span className="font-mono">{i.number}</span> · {i.companyName}
              </span>
              <span className="text-[11.5px] text-[#3f3f3f]">
                {range(i.from, i.to)} · {i.totals.tickets} tickets
              </span>
              <span className={`self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusOf(i).dark}`}>{statusOf(i).label}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-[14px] font-bold">{taka(i.totals.payout)}</span>
              <span className="text-[10.5px] text-[#0b7f8c]">Open ›</span>
            </div>
          </a>
        ))}
        {data.invoices.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No invoices yet.</div>}
      </div>
    </div>
  )
}
