'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { taka } from '@/lib/tripMoney'
import PayoutsPanel from './PayoutsPanel'
import Plate from '../Plate'
import SearchBox from '../SearchBox'
import DateRangePicker from '../DateRangePicker'
import { downloadSheet, sheetDate, type Column, type Sheet } from '@/lib/sheet'
import { matches } from '@/lib/search'

interface MoneyTrip {
  _id: string
  companyId: string
  companyName: string
  fleetId: string | null
  busName: string
  plateNumber: string
  from: string
  to: string
  date: string
  departureTime: string
  departed: boolean
  totalSeats: number
  counter: { seats: number; total: number }
  online: { tickets: number; seats: number; total: number; commission: number; payout: number }
  /** What BusHub owes the company for this trip: not invoiced yet, invoiced but unpaid, paid. */
  pay: { owed: number; invoiced: number; paid: number; invoiceId: string | null; invoiceNumber: string | null }
}

/** The trips shown, as an Excel sheet: BusHub tickets, BusHub's commission and what BusHub owes per trip. */
function moneySheet(trips: MoneyTrip[], notes: string[]): Sheet {
  const int = (header: string): Column => ({ header, kind: 'int', total: true })
  const money = (header: string): Column => ({ header, kind: 'money', total: true })
  return {
    name: 'Money by trip',
    title: 'BusHub money · trip by trip',
    notes,
    columns: [
      { header: 'Date', kind: 'date' },
      { header: 'Time' },
      { header: 'Company' },
      { header: 'From' },
      { header: 'To' },
      { header: 'Bus' },
      { header: 'Number plate' },
      int('BusHub tickets'),
      int('BusHub seats'),
      money('BusHub ticket money'),
      money('BusHub commission'),
      money('Company gets'),
      money('Not paid yet'),
      money('In unpaid invoice'),
      money('Paid'),
      { header: 'Invoice' },
      { header: 'Status' },
    ],
    rows: [...trips]
      .sort((a, b) => a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime))
      .map((t) => [
        t.date,
        t.departureTime,
        t.companyName,
        t.from,
        t.to,
        t.busName,
        t.plateNumber,
        t.online.tickets,
        t.online.seats,
        t.online.total,
        t.online.commission,
        t.online.payout,
        t.pay.owed,
        t.pay.invoiced,
        t.pay.paid,
        t.pay.invoiceNumber || '',
        t.departed ? 'Finished' : 'Upcoming',
      ]),
  }
}

const PERIODS = [
  ['all', 'All'],
  ['finished', 'Finished'],
  ['upcoming', 'Upcoming'],
] as const
type Period = (typeof PERIODS)[number][0]

function Line({ label, sub, value, tone = '', strong = false }: { label: string; sub?: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className={strong ? 'text-[13.5px] font-bold' : 'text-[13px] text-[#222222]'}>{label}</span>
        {sub && <span className="text-[11px] text-[#5e5e5e]">{sub}</span>}
      </div>
      <span className={`shrink-0 font-bold ${strong ? 'text-[16px]' : 'text-[13.5px]'} ${tone}`}>{value}</span>
    </div>
  )
}

function sum(trips: MoneyTrip[]) {
  const t = { trips: trips.length, tickets: 0, onlineSeats: 0, online: 0, commission: 0, payout: 0, toPay: 0, paid: 0, later: 0 }
  for (const x of trips) {
    t.tickets += x.online.tickets
    t.onlineSeats += x.online.seats
    t.online += x.online.total
    t.commission += x.online.commission
    t.payout += x.online.payout
    t.paid += x.pay.paid
    if (x.departed) t.toPay += x.pay.owed + x.pay.invoiced
    else t.later += x.pay.owed + x.pay.invoiced
  }
  return t
}

/** Where the trip's payment stands, and the button to pay it when it is due. */
function PayState({ trip, onPay, busy }: { trip: MoneyTrip; onPay: (t: MoneyTrip) => void; busy: boolean }) {
  if (trip.online.tickets === 0) return <span className="text-[12px] text-[#555555]">No BusHub tickets: nothing to pay.</span>
  if (!trip.departed) return <span className="text-[12px] text-[#2563eb]">Pay {taka(trip.pay.owed + trip.pay.invoiced)} after the bus leaves.</span>
  return (
    <div className="flex flex-col gap-2">
      {trip.pay.paid > 0 && <span className="text-[12px] font-semibold text-[#0a8a84]">✓ Paid {taka(trip.pay.paid)}</span>}
      {trip.pay.invoiced > 0 && trip.pay.invoiceId && (
        <a href={`/invoice/${trip.pay.invoiceId}?as=admin`} className="glass-btn btn-orange h-11 text-sm">
          Open invoice {trip.pay.invoiceNumber} · pay {taka(trip.pay.invoiced)}
        </a>
      )}
      {trip.pay.owed > 0 && (
        <button type="button" disabled={busy} onClick={() => onPay(trip)} className="glass-btn btn-orange h-11 text-sm">
          {busy ? 'Making invoice…' : `Pay this trip · ${taka(trip.pay.owed)}`}
        </button>
      )}
      {trip.pay.paid > 0 && trip.pay.invoiceId && trip.pay.owed === 0 && trip.pay.invoiced === 0 && (
        <a href={`/invoice/${trip.pay.invoiceId}?as=admin`} className="text-[12px] font-semibold text-[#0b7f8c]">
          See invoice {trip.pay.invoiceNumber} ›
        </a>
      )}
    </div>
  )
}

/**
 * Every company's trips, bus by bus: the BusHub tickets sold, BusHub's commission
 * and what BusHub owes the company, with a button to pay each trip once the bus has left.
 */
function TripsMoney() {
  const [data, setData] = useState<{ companies: { _id: string; name: string }[]; trips: MoneyTrip[] } | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [bus, setBus] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/admin/trip-money${from ? `?since=${from}` : ''}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.trips && setData(d))
      .catch(() => undefined)
  }, [from])
  useEffect(() => load(), [load])

  const buses = useMemo(() => {
    const names = new Set<string>()
    for (const t of data?.trips || []) if (!companyId || t.companyId === companyId) names.add(t.busName)
    return Array.from(names).sort()
  }, [data, companyId])

  const shown = useMemo(() => {
    const list = (data?.trips || []).filter(
      (t) =>
        (!companyId || t.companyId === companyId) &&
        (!bus || t.busName === bus) &&
        (period === 'all' || (period === 'finished' ? t.departed : !t.departed)) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        matches(search, t.companyName, t.from, t.to, t.busName, t.plateNumber, t.date, formatTripDate(t.date), t.departureTime, t.pay.invoiceNumber)
    )
    return period === 'upcoming' ? list : [...list].reverse()
  }, [data, companyId, bus, period, from, to, search])
  const total = useMemo(() => sum(shown), [shown])

  const pay = async (trip: MoneyTrip) => {
    if (!confirm(`Pay ${trip.companyName} ${taka(trip.pay.owed)} for ${trip.from} → ${trip.to}, ${formatTripDate(trip.date)} ${trip.departureTime}?`)) return
    setBusy(trip._id)
    const res = await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: trip.companyId, tripId: trip._id }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      toast.error(json?.error || 'Could not make the invoice')
      return load()
    }
    window.location.href = `/invoice/${json.invoice._id}?as=admin`
  }

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>

  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search route, number plate, company, bus, date, invoice" />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value)
            setBus('')
          }}
          className="input-dark"
          aria-label="Company"
        >
          <option value="">All companies</option>
          {data.companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={bus} onChange={(e) => setBus(e.target.value)} className="input-dark" aria-label="Bus">
          <option value="">All buses</option>
          {buses.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <DateRangePicker
            label="Travel dates"
            allText="Last 30 days + upcoming"
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f)
              setTo(t)
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (!shown.length) return toast.error('No trips to put in the sheet')
            const notes = [
              `Date range: ${from ? sheetDate(from) : 'last 30 days'} to ${to ? sheetDate(to) : 'upcoming'}`,
              companyId ? `Company: ${data.companies.find((c) => c._id === companyId)?.name}` : '',
              bus ? `Bus: ${bus}` : '',
              search.trim() ? `Search: ${search.trim()}` : '',
            ].filter(Boolean)
            downloadSheet(`BusHub money ${from || 'start'} to ${to || 'now'}`, [moneySheet(shown, notes)])
          }}
          className="glass-btn glass-btn-plain col-span-2 h-12 self-end px-4 text-[12.5px] sm:col-span-1"
        >
          ⬇ Excel sheet
        </button>
      </div>
      <div className="flex gap-1 self-start rounded-full border border-[#111111]/10 bg-white/60 p-1">
        {PERIODS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={`h-9 rounded-full px-3.5 text-[12.5px] font-bold ${period === id ? 'bg-[#111111] text-[#ffffff]' : 'text-[#3f3f3f]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="px-1 text-[11.5px] text-[#5e5e5e]">Trips of the last 30 days and upcoming trips.</p>

      {/* On a computer: the totals stay on the left while the trips scroll on the right. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="card-2 flex flex-col gap-3 px-4 py-4 lg:sticky lg:top-28">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="label-xs">BusHub earned</span>
            <span className="display text-[28px] font-bold leading-tight">{taka(total.commission)}</span>
            <span className="text-[11.5px] text-[#3f3f3f]">Commission on BusHub tickets</span>
          </div>
          <span className="pb-1 text-right text-[11.5px] text-[#3f3f3f]">
            <b className="display text-[22px] text-[#111111]">{total.tickets}</b> ticket{total.tickets === 1 ? '' : 's'}
            <br />
            {total.onlineSeats} seat{total.onlineSeats === 1 ? '' : 's'} · {total.trips} trip{total.trips === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#111111]/10 pt-3">
          <Line label="Passengers paid BusHub" sub={`${total.tickets} tickets · ${total.onlineSeats} seats`} value={taka(total.online)} tone="text-[#0b7f8c]" />
          <Line label="BusHub commission" sub="What BusHub keeps" value={taka(total.commission)} tone="text-[#0a8a84]" />
          <Line label="Companies' share" sub="What BusHub pays the companies" value={taka(total.payout)} />
        </div>
        <div className="flex flex-col gap-2 border-t border-[#111111]/10 pt-3">
          <Line label="Already paid to companies" value={taka(total.paid)} tone="text-[#0a8a84]" />
          <Line label="Pay later" sub="Trips still to leave" value={taka(total.later)} tone="text-[#2563eb]" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#f2661d] to-[#feb249] px-3.5 py-3 text-[#1a0d03] shadow-[0_10px_24px_rgba(242,102,29,0.3)]">
          <span className="text-[13.5px] font-bold">To pay now</span>
          <span className="display text-[20px] font-bold text-[#1a0d03]">{taka(total.toPay)}</span>
        </div>
      </div>

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#c9d6e4] px-4 py-3">
          <span className="label-xs">Trip by trip</span>
        </div>
        {shown.map((t) => {
          const due = t.pay.owed + t.pay.invoiced
          return (
            <details key={t._id} className="group border-b border-[#c9d6e4] last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:hidden">
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-bold">{t.companyName}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#222222]">
                    <span className="truncate">
                      {t.from} → {t.to} · {t.departureTime} · {t.busName}
                    </span>
                    <Plate plate={t.plateNumber} />
                  </span>
                  <span className="text-[11.5px] text-[#555555]">
                    {formatTripDate(t.date)} · {t.online.tickets} BusHub ticket{t.online.tickets === 1 ? '' : 's'} · BusHub earned {taka(t.online.commission)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {due > 0 ? (
                    <>
                      <span className={`text-[14px] font-bold ${t.departed ? 'text-[#0b7f8c]' : 'text-[#2563eb]'}`}>{taka(due)}</span>
                      <span className="text-[10.5px] text-[#4a4a4a]">{t.departed ? 'to pay' : 'pay later'}</span>
                    </>
                  ) : t.pay.paid > 0 ? (
                    <span className="text-[12px] font-bold text-[#0a8a84]">Paid ✓</span>
                  ) : (
                    <span className="text-[11px] text-[#555555]">Nothing to pay</span>
                  )}
                  <span className="text-[10.5px] text-[#0b7f8c] group-open:hidden">Details ›</span>
                  <span className="hidden text-[10.5px] text-[#0b7f8c] group-open:inline">Hide ‹</span>
                </div>
              </summary>
              <div className="flex flex-col gap-3 bg-white/60 px-4 pb-4 pt-2 text-[12.5px]">
                <div className="flex flex-col gap-1.5">
                  <Line label={`BusHub · ${t.online.tickets} tickets, ${t.online.seats} seats`} value={taka(t.online.total)} tone="text-[#0b7f8c]" />
                  <Line label="BusHub commission" value={taka(t.online.commission)} tone="text-[#0a8a84]" />
                  <Line label="Company gets from BusHub" value={taka(t.online.payout)} strong />
                </div>
                <PayState trip={t} onPay={pay} busy={busy === t._id} />
              </div>
            </details>
          )
        })}
        {shown.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No trips here.</div>}
      </div>
      </div>
    </div>
  )
}

/** The admin's Money page: every trip's sales and payment, and paying each company in one go. */
export default function CostsSection() {
  const [view, setView] = useState<'trips' | 'pay'>('trips')
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex gap-1 self-start rounded-full border border-[#111111]/10 bg-white/60 p-1">
        {(
          [
            ['trips', 'By trip'],
            ['pay', 'By company'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`h-9 rounded-full px-4 text-[12.5px] font-bold ${view === id ? 'bg-[#53d3d1] text-[#002447]' : 'text-[#3f3f3f]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'pay' ? <PayoutsPanel /> : <TripsMoney />}
    </div>
  )
}
