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
import TripForm from './TripForm'
import { changeSeat, useTrips } from './useTrips'
import { tripCounts, type CompanyTrip } from './types'

const TABS = [
  ['trips', 'Trips'],
  ['sales', 'Sales'],
  ['payments', 'Payments'],
  ['scans', 'Scans'],
  ['staff', 'Staff'],
] as const

const taka = (n: number) => `৳${n.toLocaleString('en-US')}`

function dhakaTime(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
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
            <span className="truncate text-[14px] font-bold">
              {trip.from} → {trip.to} · {trip.departureTime}
            </span>
            <span className="truncate text-[11.5px] text-[#9ba7aa]">
              {formatTripDate(trip.date)} · {trip.busName}
            </span>
            {trip.boardingPoint && <span className="truncate text-[11px] text-[#6e7b7e]">📍 {trip.boardingPoint}</span>}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="display text-[17px] font-bold">
              {c.online + c.counter}
              <span className="text-[12px] font-semibold text-[#8e9a9d]">/{trip.totalSeats}</span>
            </span>
            <span className="text-[10.5px] text-[#8e9a9d]">sold</span>
          </div>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-[#12372c]">
          <span style={{ width: pct(c.online) }} className="bg-gradient-to-r from-[#f2661d] to-[#f5a524]" />
          <span style={{ width: pct(c.held) }} className="bg-[#f5a524]/40" />
          <span style={{ width: pct(c.counter) }} className="bg-[#6d4aff]" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <span className="text-[#f5a524]">BusHub {c.online}</span>
          {c.held > 0 && <span className="text-[#f5a524]/70">Buying now {c.held}</span>}
          <span className="text-[#a78bfa]">Counter {c.counter}</span>
          <span className="text-[#34d399]">Free {c.free}</span>
          <span className="ml-auto text-[#f5a524]">{open ? 'Hide seats ‹' : 'Seat map ›'}</span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-[#1a2123] bg-black/15 px-4 py-4">
          <SeatMap trip={trip} busySeat={busySeat} onTap={trip.departed ? undefined : tap} />
          {bySeller.size > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label-xs">Sold at the counter</span>
              {Array.from(bySeller).map(([seller, seats]) => (
                <div key={seller} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="font-semibold text-[#c4b5fd]">{seller}</span>
                  <span className="text-right text-[#c4cdcf]">
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
                  <span className="min-w-0 truncate">
                    {t.passengerName} <span className="text-[#78868a]">· {t.seats.join(', ')}</span>
                  </span>
                  <span className={`shrink-0 font-semibold ${t.boarded ? 'text-[#34d399]' : 'text-[#9ba7aa]'}`}>{t.boarded ? 'Boarded ✓' : taka(t.payout)}</span>
                </div>
              ))}
            </div>
          )}
          {trip.counterSeats.some((s) => s.soldAt) && (
            <p className="text-[11px] text-[#6e7b7e]">
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
export default function ManagerView() {
  const { data, reload } = useTrips()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('trips')
  const [busId, setBusId] = useState('')
  const [when, setWhen] = useState<'upcoming' | 'finished'>('upcoming')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bookings, setBookings] = useState<SaleBooking[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [payments, setPayments] = useState<PaymentsData | null>(null)

  useEffect(() => {
    fetch('/api/bookings?as=company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
      .catch(() => undefined)
    fetch('/api/company/payouts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.owed && setPayments(d))
      .catch(() => undefined)
    fetch('/api/scan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => !d.error && setStats(d))
      .catch(() => undefined)
  }, [])

  const trips = data?.trips ?? []
  const upcoming = trips.filter((t) => !t.departed)
  const shown = useMemo(() => {
    const list = trips.filter((t) => (when === 'upcoming' ? !t.departed : t.departed) && (!busId || t.fleetId === busId))
    return when === 'finished' ? [...list].reverse() : list
  }, [trips, when, busId])
  const sold = upcoming.reduce(
    (acc, t) => {
      const c = tripCounts(t)
      return { online: acc.online + c.online, counter: acc.counter + c.counter }
    },
    { online: 0, counter: 0 }
  )
  // Everything BusHub has not paid yet: invoiced or not, trips gone or still to leave.
  const owed = payments ? payments.owed.payout + payments.invoiced + payments.later.payout : null
  const toSign = payments?.invoices.filter((i) => i.status === 'paid').length ?? 0

  if (!data) return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1 rounded-[18px] bg-gradient-to-br from-[#12756c] to-[#0e5a54] p-3.5">
          <span className="text-[11px] font-bold text-[#b8ede6]">Upcoming trips</span>
          <span className="display text-[24px] font-bold leading-none text-white">{upcoming.length}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[18px] bg-gradient-to-br from-[#5b3fd6] to-[#3f2a9e] p-3.5">
          <span className="text-[11px] font-bold text-[#ddd3ff]">Seats sold</span>
          <span className="display text-[24px] font-bold leading-none text-white">{sold.online + sold.counter}</span>
          <span className="text-[10.5px] text-[#ddd3ff]">
            {sold.online} online · {sold.counter} counter
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[18px] bg-gradient-to-br from-[#c77a0e] to-[#a25f06] p-3.5">
          <span className="text-[11px] font-bold text-[#fae3bc]">BusHub owes</span>
          <span className="display text-[20px] font-bold leading-tight text-white">{owed === null ? '–' : taka(owed)}</span>
          {toSign > 0 && <span className="text-[10.5px] font-bold text-white">{toSign} to sign</span>}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`chip shrink-0 ${tab === id ? 'chip-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'trips' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={busId} onChange={(e) => setBusId(e.target.value)} className="input-dark sm:grow" aria-label="Bus">
              <option value="">All buses</option>
              {data.fleet.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name} · {f.busType}
                </option>
              ))}
            </select>
            <div className="flex gap-1 self-start rounded-full border border-white/10 bg-black/30 p-1">
              {(['upcoming', 'finished'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWhen(w)}
                  className={`h-9 rounded-full px-4 text-[12.5px] font-bold capitalize ${when === w ? 'bg-[#f6f1ea] text-[#14191b]' : 'text-[#9ba7aa]'}`}
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
            <p className="glass-lite p-5 text-center text-[13px] text-[#8e9a9d]">
              {when === 'upcoming' ? 'No upcoming trips.' : 'No finished trips in the last 30 days.'}
            </p>
          )}
          {shown.map((t) => (
            <TripCard key={t._id} trip={t} open={open === t._id} onToggle={() => setOpen(open === t._id ? null : t._id)} onChanged={reload} />
          ))}
        </div>
      )}

      {tab === 'sales' && <MoneyView trips={trips} fleet={data.fleet} me={data.me} bookings={bookings} onChanged={reload} />}
      {tab === 'payments' && <PaymentsPanel data={payments} />}
      {tab === 'scans' && <ScanHistory stats={stats} showScanner />}
      {tab === 'staff' && <StaffPanel />}
    </div>
  )
}
