'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { addMoney, taka } from '@/lib/tripMoney'
import CostEditor from './CostEditor'
import MoneyCard, { Line } from './MoneyCard'
import SalesBreakdown, { type SaleBooking } from './SalesBreakdown'
import StaffSales from './StaffSales'
import { busLabel, companyTripMoney, tripSearchText, type CompanyTrip, type FleetOption } from './types'
import SearchBox from '../SearchBox'
import { matches } from '@/lib/search'
import Plate from '../Plate'
import { downloadSheet } from '@/lib/sheet'
import { companySalesSheets } from './salesSheet'
import DateTable from './DateTable'
import DateRangePicker, { rangeLabel } from '../DateRangePicker'

const PERIODS = [
  ['all', 'All'],
  ['finished', 'Finished'],
  ['upcoming', 'Upcoming'],
] as const
type Period = (typeof PERIODS)[number][0]
const PERIOD_TEXT: Record<Period, string> = {
  all: 'Trips of the last 30 days and upcoming trips',
  finished: 'Trips that left in the last 30 days',
  upcoming: 'Trips still to leave',
}

function TripRow({ trip, me, onChanged }: { trip: CompanyTrip; me: { role: string; staffId: string | null }; onChanged: () => Promise<void> }) {
  const m = companyTripMoney(trip)
  return (
    <details className="group border-b border-[#c9d6e4] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:hidden">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold">
            <span className="truncate">
              {trip.from} → {trip.to} · {trip.departureTime}
            </span>
            <Plate plate={trip.plateNumber} />
          </span>
          <span className="truncate text-[11.5px] text-[#3f3f3f]">
            {formatTripDate(trip.date)} · {trip.busName}
          </span>
          <span className="text-[11.5px] text-[#555555]">
            {m.seats.online + m.seats.counter}/{m.seats.total} sold · tickets {taka(m.ticketMoney)} · costs {taka(m.costs.total)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={`text-[14px] font-bold ${m.left < 0 ? 'text-[#d23c3c]' : 'text-[#0a8a84]'}`}>{taka(m.left)}</span>
          <span className="text-[10.5px] text-[#4a4a4a]">left</span>
          <span className="text-[10.5px] text-[#0b7f8c] group-open:hidden">Details ›</span>
          <span className="hidden text-[10.5px] text-[#0b7f8c] group-open:inline">Hide ‹</span>
        </div>
      </summary>
      <div className="flex flex-col gap-4 bg-white/60 px-4 pb-4 pt-2">
        <div className="flex flex-col gap-1.5 text-[12.5px]">
          <Line label={`Counter · ${m.counter.seats} seats`} value={taka(m.counter.total)} tone="text-[#2d7886]" />
          <Line label={`BusHub · ${m.seats.online} seats paid by passengers`} value={taka(m.online.total)} tone="text-[#0b7f8c]" />
          <Line label="You get from BusHub" value={taka(m.online.payout)} tone="text-[#0b7f8c]" />
          <Line label={`Not sold · ${m.seats.notSold} seats`} value="" />
        </div>
        <CostEditor tripId={trip._id} costs={trip.costs || []} me={me} onChanged={onChanged} />
      </div>
    </details>
  )
}

const VIEWS = [
  ['dates', 'Date by date'],
  ['trips', 'Trip by trip'],
  ['total', 'Total money'],
  ['sellers', 'Who sold'],
] as const
type View = (typeof VIEWS)[number][0]

/**
 * The manager's money page: pick a bus, dates or a period, then see it trip by trip, as one total
 * (counter and BusHub money, BusHub's fee, costs, what is left) or by who sold. Everything shown
 * can be downloaded as an Excel sheet.
 */
export default function MoneyView({
  trips,
  fleet,
  me,
  bookings,
  onChanged,
  onFrom,
  companyName,
}: {
  trips: CompanyTrip[]
  fleet: FleetOption[]
  me: { role: string; staffId: string | null }
  bookings: SaleBooking[]
  onChanged: () => Promise<void>
  /** Asks for older trips when the From date is before what is loaded. */
  onFrom: (date: string) => void
  companyName: string
}) {
  const [busId, setBusId] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<View>('dates')

  const shown = useMemo(() => {
    const list = trips.filter(
      (t) =>
        (!busId || t.fleetId === busId) &&
        (period === 'all' || (period === 'finished' ? t.departed : !t.departed)) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        matches(search, tripSearchText(t), (t.costs || []).map((c) => [c.note, c.addedBy]))
    )
    // Newest first, except trips still to come, which read soonest first.
    return period === 'upcoming' ? list : [...list].reverse()
  }, [trips, busId, period, from, to, search])
  const total = useMemo(() => addMoney(shown.map(companyTripMoney)), [shown])
  const dates = from || to ? rangeLabel(from, to) : ''

  const pickFrom = (date: string) => {
    setFrom(date)
    onFrom(date)
  }
  const download = () => {
    if (shown.length === 0) return toast.error('No trips to put in the sheet')
    const first = shown.reduce((d, t) => (t.date < d ? t.date : d), shown[0].date)
    const last = shown.reduce((d, t) => (t.date > d ? t.date : d), shown[0].date)
    const bus = fleet.find((f) => f._id === busId)
    const filters = [
      bus ? `Bus: ${busLabel(bus)}` : '',
      period !== 'all' ? `Trips: ${PERIODS.find(([id]) => id === period)?.[1]}` : '',
      search.trim() ? `Search: ${search.trim()}` : '',
    ].filter(Boolean)
    downloadSheet(`${companyName} sales ${first} to ${last}`, companySalesSheets(shown, companyName, filters))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid grid-cols-2 gap-1 rounded-[22px] border border-[#111111]/10 bg-white/60 p-1 sm:flex sm:rounded-full">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-bold ${view === id ? 'bg-[#feb249] text-[#1a0d03]' : 'text-[#3f3f3f]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={download} className="glass-btn glass-btn-plain h-11 shrink-0 px-4 text-[12.5px] sm:ml-auto">
          ⬇ Download Excel sheet
        </button>
      </div>

      <SearchBox value={search} onChange={setSearch} placeholder="Search route, number plate, bus, date, counter" />
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <select value={busId} onChange={(e) => setBusId(e.target.value)} className="input-dark" aria-label="Bus">
          <option value="">All buses</option>
          {fleet.map((f) => (
            <option key={f._id} value={f._id}>
              {busLabel(f)}
            </option>
          ))}
        </select>
        <div className="min-w-0 lg:w-[300px]">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              pickFrom(f)
              setTo(t)
            }}
          />
        </div>
        <div className="flex gap-1 self-end justify-self-start rounded-full border border-[#111111]/10 bg-white/60 p-1">
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
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#111111]/10 bg-white/60 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10.5px] text-[#4a4a4a]">
            {shown.length} trip{shown.length === 1 ? '' : 's'} · {total.seats.online + total.seats.counter} seats
          </span>
          <span className="truncate text-[15px] font-bold">{taka(total.ticketMoney)}</span>
          <span className="text-[10.5px] text-[#5e5e5e]">ticket money</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[10.5px] text-[#4a4a4a]">You receive</span>
          <span className="truncate text-[15px] font-bold text-[#0b7f8c]">{taka(total.companyGets)}</span>
          <span className="text-[10.5px] text-[#5e5e5e]">costs {taka(total.costs.total)}</span>
        </div>
        <div className="flex min-w-0 flex-col items-end text-right">
          <span className="text-[10.5px] text-[#4a4a4a]">Left</span>
          <span className={`truncate text-[15px] font-bold ${total.left < 0 ? 'text-[#d23c3c]' : 'text-[#0a8a84]'}`}>{taka(total.left)}</span>
          <span className="truncate text-[10.5px] text-[#5e5e5e]">{dates || PERIODS.find(([id]) => id === period)?.[1]}</span>
        </div>
      </div>

      {view === 'dates' && <DateTable trips={shown} />}
      {view === 'total' && <MoneyCard m={total} trips={shown.length} />}
      {view === 'sellers' && <StaffSales trips={shown} period={dates || PERIOD_TEXT[period]} />}
      {view === 'trips' && (
        <div className="card-2 overflow-hidden">
          <div className="flex flex-col gap-0.5 border-b border-[#c9d6e4] px-4 py-3">
            <span className="label-xs">Trip by trip</span>
            <span className="text-[11px] text-[#5e5e5e]">Open a trip to see its money and add or check costs</span>
          </div>
          {shown.map((t) => (
            <TripRow key={t._id} trip={t} me={me} onChanged={onChanged} />
          ))}
          {shown.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No trips here.</div>}
        </div>
      )}

      {view === 'total' && (
        <details className="group mt-1">
          <summary className="label-xs cursor-pointer list-none px-1 py-2 marker:hidden">
            <span className="group-open:hidden">Every BusHub ticket, all time ›</span>
            <span className="hidden group-open:inline">Every BusHub ticket, all time ‹</span>
          </summary>
          <div className="mt-2">
            <SalesBreakdown bookings={bookings} />
          </div>
        </details>
      )}
    </div>
  )
}
