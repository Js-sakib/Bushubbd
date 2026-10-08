'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import MoneyView from './MoneyView'
import PaymentsPanel, { type PaymentsData } from './PaymentsPanel'
import type { SaleBooking } from './SalesBreakdown'
import ScanHistory, { type ScanStats } from './ScanHistory'
import SeatMap, { type SeatKind } from './SeatMap'
import StaffPanel from './StaffPanel'
import { DaySalesPanel } from './DaySales'
import TripForm from './TripForm'
import { changeSeat, useTrips } from './useTrips'
import { busLabel, tripCounts, tripSearchText, type CompanyTrip } from './types'
import SearchBox from '../SearchBox'
import { matches } from '@/lib/search'
import Plate from '../Plate'
import ReportsView from '../reports/ReportsView'

const TABS = [
  ['trips', 'Trips'],
  ['reports', 'Reports'],
  ['sales', 'Sales'],
  ['counter', 'Counter sales'],
  ['payments', 'Payments'],
  ['scans', 'Scans'],
  ['staff', 'Staff'],
] as const

const taka = (n: number) => `৳${n.toLocaleString('en-US')}`

function dhakaTime(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}

const STAT_TONES = {
  navy: 'bg-[#002447] text-[#fbeceb] shadow-[0_10px_24px_rgba(0,36,71,0.3)]',
  aqua: 'bg-[#53d3d1] text-[#002447] shadow-[0_10px_24px_rgba(83,211,209,0.4)]',
  pink: 'bg-[#fbeceb] text-[#002447] shadow-[0_10px_24px_rgba(0,36,71,0.12)] border border-[#002447]/10',
}

/** A number at the top that opens its details when tapped. */
function StatButton({
  tone,
  label,
  value,
  sub,
  small = false,
  active,
  onClick,
}: {
  tone: keyof typeof STAT_TONES
  label: string
  value: string
  sub?: string
  small?: boolean
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 flex-col gap-1 rounded-[18px] p-3.5 text-left transition hover:-translate-y-0.5 ${STAT_TONES[tone]} ${
        active ? '!shadow-[0_12px_30px_rgba(242,102,29,0.45)] ring-[3px] ring-[#f2661d] ring-offset-2 ring-offset-transparent' : ''
      }`}
    >
      <span className="text-[11px] font-bold opacity-80">{label}</span>
      <span className={`display font-bold leading-none ${small ? 'text-[20px]' : 'text-[24px]'}`}>{value}</span>
      {sub && <span className="text-[10.5px] opacity-80">{sub}</span>}
      <span className="mt-auto pt-1 text-[10.5px] font-bold opacity-90">Details ›</span>
    </button>
  )
}

/** One trip: how full it is at a glance, and the whole seat map with who sold what when opened. */
function TripCard({ trip, open, onToggle, onChanged }: { trip: CompanyTrip; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  const c = tripCounts(trip)
  const [busySeat, setBusySeat] = useState<string | null>(null)
  const pct = (n: number) => `${(n / Math.max(1, trip.totalSeats)) * 100}%`
  const bySeller = new Map<string, string[]>()
  for (const s of trip.counterSeats) bySeller.set(s.soldBy, [...(bySeller.get(s.soldBy) || []), s.seat])
  const payout = (trip.onlineTickets || []).reduce((sum, t) => sum + t.payout, 0)

  // The manager can sell at the counter too, and undo any counter sale (for a mistake).
  const tap = async (seat: string, kind: SeatKind) => {
    if (kind === 'online') return toast(`Seat ${seat} is sold on BusHub.`)
    if (kind === 'held') return toast(`Someone is buying seat ${seat} online right now.`)
    if (kind === 'counter' || kind === 'mine') {
      const sale = trip.counterSeats.find((s) => s.seat === seat)
      if (!confirm(`Seat ${seat} was sold by ${sale?.soldBy}. Free it again?`)) return
    }
    setBusySeat(seat)
    await changeSeat(trip, seat, kind === 'free' ? 'sell' : 'unsell')
    await onChanged()
    setBusySeat(null)
  }

  return (
    <div className="card-2 overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full flex-col gap-2.5 px-4 py-3.5 text-left">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold">
              <span className="truncate">
                {trip.from} → {trip.to} · {trip.departureTime}
              </span>
              <Plate plate={trip.plateNumber} />
            </span>
            <span className="truncate text-[11.5px] text-[#3f3f3f]">
              {formatTripDate(trip.date)} · {trip.busName}
            </span>
            {trip.boardingPoint && <span className="truncate text-[11px] text-[#5e5e5e]">📍 {trip.boardingPoint}</span>}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="display text-[17px] font-bold">
              {c.online + c.counter}
              <span className="text-[12px] font-semibold text-[#4a4a4a]">/{trip.totalSeats}</span>
            </span>
            <span className="text-[10.5px] text-[#4a4a4a]">sold</span>
          </div>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-[#dff6f5]">
          <span style={{ width: pct(c.online) }} className="bg-gradient-to-r from-[#f2661d] to-[#feb249]" />
          <span style={{ width: pct(c.held) }} className="bg-[#feb249]/40" />
          <span style={{ width: pct(c.counter) }} className="bg-[#5eb1bf]" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <span className="text-[#0b7f8c]">BusHub {c.online}</span>
          {c.held > 0 && <span className="text-[#0b7f8c]/70">Buying now {c.held}</span>}
          <span className="text-[#2d7886]">Counter {c.counter}</span>
          <span className="text-[#0a8a84]">Free {c.free}</span>
          <span className="ml-auto text-[#0b7f8c]">{open ? 'Hide seats ‹' : 'Seat map ›'}</span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-[#c9d6e4] bg-white/60 px-4 py-4">
          <SeatMap trip={trip} busySeat={busySeat} onTap={trip.departed ? undefined : tap} />
          {bySeller.size > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label-xs">Sold at the counter</span>
              {Array.from(bySeller).map(([seller, seats]) => (
                <div key={seller} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="font-semibold text-[#2d7886]">{seller}</span>
                  <span className="text-right text-[#222222]">
                    {seats.length} · {seats.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(trip.onlineTickets || []).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label-xs">Sold on BusHub · you get {taka(payout)}</span>
              {trip.onlineTickets!.map((t) => (
                <div key={t.code} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="flex min-w-0 flex-col">
                    <span>
                      Seats {t.seats.join(', ')} <span className="text-[#555555]">· sold by BusHub</span>
                    </span>
                    <span className="truncate font-mono text-[11px] text-[#555555]">
                      {t.code}
                      {t.bookedAt ? ` · ${dhakaTime(t.bookedAt)}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold ${t.boarded ? 'text-[#0a8a84]' : 'text-[#3f3f3f]'}`}>{t.boarded ? 'Boarded ✓' : taka(t.payout)}</span>
                </div>
              ))}
            </div>
          )}
          {trip.counterSeats.some((s) => s.soldAt) && (
            <p className="text-[11px] text-[#5e5e5e]">
              Last counter sale: {dhakaTime(trip.counterSeats.map((s) => s.soldAt || '').sort().pop() || null)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The company manager's page: every trip of every bus with seats sold on BusHub and at each
 * counter, what BusHub owes, every scanner's scans, and the staff logins.
 */
export default function ManagerView({ companyName }: { companyName: string }) {
  const [since, setSince] = useState('')
  const { data, reload } = useTrips(since)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('trips')
  const [busId, setBusId] = useState('')
  const [search, setSearch] = useState('')
  const [when, setWhen] = useState<'upcoming' | 'finished'>('upcoming')
  // The Seats sold button opens Sales on Who sold for the trips to come; the Sales tab opens on Date by date.
  const [salesStart, setSalesStart] = useState<'dates' | 'sellers'>('dates')
  const [salesKey, setSalesKey] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bookings, setBookings] = useState<SaleBooking[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [payments, setPayments] = useState<PaymentsData | null>(null)
  const loadPayments = () =>
    fetch('/api/company/payouts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.owed && setPayments(d))
      .catch(() => undefined)

  useEffect(() => {
    fetch('/api/bookings?as=company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
      .catch(() => undefined)
    loadPayments()
    fetch('/api/scan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => !d.error && setStats(d))
      .catch(() => undefined)
  }, [])

  const trips = data?.trips ?? []
  const upcoming = trips.filter((t) => !t.departed)
  const shown = useMemo(() => {
    const list = trips.filter(
      (t) => (when === 'upcoming' ? !t.departed : t.departed) && (!busId || t.fleetId === busId) && matches(search, tripSearchText(t))
    )
    return when === 'finished' ? [...list].reverse() : list
  }, [trips, when, busId, search])
  const sold = upcoming.reduce(
    (acc, t) => {
      const c = tripCounts(t)
      return { online: acc.online + c.online, counter: acc.counter + c.counter }
    },
    { online: 0, counter: 0 }
  )
  // Everything BusHub has not paid yet (invoiced or not, trips gone or still to leave), less
  // refunds the company owes back.
  const owed = payments
    ? payments.owed.payout + payments.invoiced + payments.later.payout - payments.refunds.reduce((n, r) => n + r.amount, 0)
    : null
  const toSign = payments?.invoices.filter((i) => i.status === 'paid').length ?? 0

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>

  return (
    <div className="mt-5 flex flex-col gap-4">
      {/* The three numbers are buttons: each opens the page with its details. */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatButton
          tone="navy"
          active={tab === 'trips' && when === 'upcoming'}
          label="Upcoming trips"
          value={String(upcoming.length)}
          onClick={() => {
            setTab('trips')
            setWhen('upcoming')
          }}
        />
        <StatButton
          tone="aqua"
          active={tab === 'sales' && salesStart === 'sellers'}
          label="Seats sold"
          value={String(sold.online + sold.counter)}
          sub={`${sold.online} online · ${sold.counter} counter`}
          onClick={() => {
            setSalesStart('sellers')
            setSalesKey((k) => k + 1)
            setTab('sales')
          }}
        />
        <StatButton
          tone="pink"
          active={tab === 'payments'}
          label="BusHub owes"
          value={owed === null ? '–' : taka(owed)}
          small
          sub={toSign > 0 ? `${toSign} to sign` : undefined}
          onClick={() => setTab('payments')}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === 'sales' && tab !== 'sales') {
                setSalesStart('dates')
                setSalesKey((k) => k + 1)
              }
              setTab(id)
            }}
            className={`chip shrink-0 ${tab === id ? 'chip-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'trips' && (
        <div className="flex flex-col gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Search route, number plate, bus, date, counter" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={busId} onChange={(e) => setBusId(e.target.value)} className="input-dark sm:grow" aria-label="Bus">
              <option value="">All buses</option>
              {data.fleet.map((f) => (
                <option key={f._id} value={f._id}>
                  {busLabel(f)}
                </option>
              ))}
            </select>
            <div className="flex gap-1 self-start rounded-full border border-[#111111]/10 bg-white/60 p-1">
              {(['upcoming', 'finished'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWhen(w)}
                  className={`h-9 rounded-full px-4 text-[12.5px] font-bold capitalize ${when === w ? 'bg-[#111111] text-[#ffffff]' : 'text-[#3f3f3f]'}`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)} className="glass-btn glass-btn-plain h-11 text-sm">
            {adding ? 'Close' : '+ Add a trip'}
          </button>
          {adding && (
            <TripForm
              fleet={data.fleet}
              cities={data.cities}
              trips={trips}
              onCreated={async (id) => {
                await reload()
                setAdding(false)
                setWhen('upcoming')
                setOpen(id)
              }}
            />
          )}
          {shown.length === 0 && (
            <p className="glass-lite p-5 text-center text-[13px] text-[#4a4a4a]">
              {search ? 'No trips match your search.' : when === 'upcoming' ? 'No upcoming trips.' : 'No finished trips in the last 30 days.'}
            </p>
          )}
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {shown.map((t) => (
              <TripCard key={t._id} trip={t} open={open === t._id} onToggle={() => setOpen(open === t._id ? null : t._id)} onChanged={reload} />
            ))}
          </div>
        </div>
      )}

      {tab === 'sales' && <MoneyView trips={trips} fleet={data.fleet} me={data.me} bookings={bookings} onChanged={reload} onFrom={setSince} companyName={companyName} key={salesKey} startView={salesStart} startPeriod={salesStart === 'sellers' ? 'upcoming' : 'all'} />}
      {tab === 'counter' && <DaySalesPanel company={companyName} />}
      {tab === 'reports' && <ReportsView scope="company" />}
      {tab === 'payments' && <PaymentsPanel data={payments} companyName={companyName} />}
      {tab === 'scans' && <ScanHistory stats={stats} showScanner />}
      {tab === 'staff' && <StaffPanel />}
    </div>
  )
}
