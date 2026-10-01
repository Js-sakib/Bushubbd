'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { COST_LABELS, addMoney, taka, type TripCost, type TripMoney } from '@/lib/tripMoney'
import MoneyCard, { Line } from '../company/MoneyCard'
import PayoutsPanel from './PayoutsPanel'

interface MoneyTrip {
  _id: string
  companyId: string
  companyName: string
  busName: string
  from: string
  to: string
  date: string
  departureTime: string
  departed: boolean
  money: TripMoney
  costs: TripCost[]
}

const PERIODS = [
  ['all', 'All'],
  ['finished', 'Finished'],
  ['upcoming', 'Upcoming'],
] as const
type Period = (typeof PERIODS)[number][0]

function dhakaTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}

/**
 * Every company's trips with their money and costs, for the BusHub admin to watch: ticket money,
 * BusHub's commission, payouts, counter sales, the costs the bus staff entered and what is left.
 */
function TripsMoney() {
  const [data, setData] = useState<{ companies: { _id: string; name: string }[]; trips: MoneyTrip[] } | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [period, setPeriod] = useState<Period>('all')

  const load = useCallback(() => {
    fetch('/api/admin/trip-money', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.trips && setData(d))
      .catch(() => undefined)
  }, [])
  useEffect(() => load(), [load])

  const shown = useMemo(() => {
    const list = (data?.trips || []).filter(
      (t) => (!companyId || t.companyId === companyId) && (period === 'all' || (period === 'finished' ? t.departed : !t.departed))
    )
    return period === 'upcoming' ? list : [...list].reverse()
  }, [data, companyId, period])
  const total = useMemo(() => addMoney(shown.map((t) => t.money)), [shown])

  if (!data) return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="input-dark sm:grow" aria-label="Company">
          <option value="">All companies</option>
          {data.companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 self-start rounded-full border border-white/10 bg-black/30 p-1">
          {PERIODS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`h-9 rounded-full px-3.5 text-[12.5px] font-bold ${period === id ? 'bg-[#f6f1ea] text-[#14191b]' : 'text-[#9ba7aa]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="px-1 text-[11.5px] text-[#6e7b7e]">Trips of the last 30 days and upcoming trips. Costs are entered by each company&apos;s bus staff and manager.</p>

      <MoneyCard m={total} trips={shown.length} forAdmin />

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#1a2123] px-4 py-3">
          <span className="label-xs">Trip by trip</span>
        </div>
        {shown.map((t) => (
          <details key={t._id} className="group border-b border-[#1a2123] last:border-b-0">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:hidden">
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-bold">{t.companyName}</span>
                <span className="truncate text-[12px] text-[#c4cdcf]">
                  {t.from} → {t.to} · {t.departureTime} · {t.busName}
                </span>
                <span className="text-[11.5px] text-[#78868a]">
                  {formatTripDate(t.date)} · {t.money.seats.online + t.money.seats.counter}/{t.money.seats.total} sold · costs {taka(t.money.costs.total)}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-[14px] font-bold text-[#34d399]">{taka(t.money.online.fee)}</span>
                <span className="text-[10.5px] text-[#8e9a9d]">commission</span>
                <span className="text-[10.5px] text-[#f5a524] group-open:hidden">Details ›</span>
                <span className="hidden text-[10.5px] text-[#f5a524] group-open:inline">Hide ‹</span>
              </div>
            </summary>
            <div className="flex flex-col gap-1.5 bg-black/20 px-4 pb-4 pt-2 text-[12.5px]">
              <Line label={`BusHub · ${t.money.seats.online} seats paid by passengers`} value={taka(t.money.online.total)} tone="text-[#f5a524]" />
              <Line label="BusHub commission" value={taka(t.money.online.fee)} tone="text-[#34d399]" />
              <Line label="BusHub pays the company" value={taka(t.money.online.payout)} />
              <Line label={`Counter · ${t.money.counter.seats} seats`} value={taka(t.money.counter.total)} tone="text-[#c4b5fd]" />
              <Line label={`Not sold · ${t.money.seats.notSold} seats`} value="" />
              <Line label="Costs" value={`−${taka(t.money.costs.total)}`} tone="text-[#fca5a5]" />
              {t.costs.map((c) => (
                <div key={c._id} className="flex items-start justify-between gap-3 pl-3 text-[12px]">
                  <span className="min-w-0 text-[#c4cdcf]">
                    {COST_LABELS[c.type].en}
                    {c.note && <span> · {c.note}</span>}
                    <span className="text-[#6e7b7e]">
                      {' '}
                      · {c.addedBy}, {dhakaTime(c.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[#fca5a5]">{taka(c.amount)}</span>
                </div>
              ))}
              <Line label="Company keeps after costs" value={taka(t.money.left)} strong tone={t.money.left < 0 ? 'text-[#f87171]' : 'text-[#5eead4]'} />
            </div>
          </details>
        ))}
        {shown.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No trips here.</div>}
      </div>
    </div>
  )
}

/** The admin's Money page: paying the bus companies, and every trip's money and costs. */
export default function CostsSection() {
  const [view, setView] = useState<'pay' | 'trips'>('pay')
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex gap-1 self-start rounded-full border border-white/10 bg-black/30 p-1">
        {(
          [
            ['pay', 'Pay companies'],
            ['trips', 'Trips & costs'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`h-9 rounded-full px-4 text-[12.5px] font-bold ${view === id ? 'bg-gradient-to-r from-[#f2661d] to-[#f5a524] text-[#1a0d03]' : 'text-[#9ba7aa]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'pay' ? <PayoutsPanel /> : <TripsMoney />}
    </div>
  )
}
