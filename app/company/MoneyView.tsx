'use client'

import { useMemo, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { addMoney, taka } from '@/lib/tripMoney'
import CostEditor from './CostEditor'
import MoneyCard, { Line } from './MoneyCard'
import SalesBreakdown, { type SaleBooking } from './SalesBreakdown'
import StaffSales from './StaffSales'
import { busLabel, companyTripMoney, type CompanyTrip, type FleetOption } from './types'
import Plate from '../Plate'

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
    <details className="group border-b border-[#1a2123] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:hidden">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold">
            <span className="truncate">
              {trip.from} → {trip.to} · {trip.departureTime}
            </span>
            <Plate plate={trip.plateNumber} />
          </span>
          <span className="truncate text-[11.5px] text-[#9ba7aa]">
            {formatTripDate(trip.date)} · {trip.busName}
          </span>
          <span className="text-[11.5px] text-[#78868a]">
            {m.seats.online + m.seats.counter}/{m.seats.total} sold · tickets {taka(m.ticketMoney)} · costs {taka(m.costs.total)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={`text-[14px] font-bold ${m.left < 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{taka(m.left)}</span>
          <span className="text-[10.5px] text-[#8e9a9d]">left</span>
          <span className="text-[10.5px] text-[#f5a524] group-open:hidden">Details ›</span>
          <span className="hidden text-[10.5px] text-[#f5a524] group-open:inline">Hide ‹</span>
        </div>
      </summary>
      <div className="flex flex-col gap-4 bg-black/20 px-4 pb-4 pt-2">
        <div className="flex flex-col gap-1.5 text-[12.5px]">
          <Line label={`Counter · ${m.counter.seats} seats`} value={taka(m.counter.total)} tone="text-[#c4b5fd]" />
          <Line label={`BusHub · ${m.seats.online} seats paid by passengers`} value={taka(m.online.total)} tone="text-[#f5a524]" />
          <Line label="You get from BusHub" value={taka(m.online.payout)} tone="text-[#f5a524]" />
          <Line label={`Not sold · ${m.seats.notSold} seats`} value="" />
        </div>
        <CostEditor tripId={trip._id} costs={trip.costs || []} me={me} onChanged={onChanged} />
      </div>
    </details>
  )
}

/**
 * The manager's money page: pick a bus and a period, see ticket money from the counter and BusHub,
 * BusHub's fee, the costs the bus staff entered and what is left, then trip by trip.
 */
export default function MoneyView({
  trips,
  fleet,
  me,
  bookings,
  onChanged,
}: {
  trips: CompanyTrip[]
  fleet: FleetOption[]
  me: { role: string; staffId: string | null }
  bookings: SaleBooking[]
  onChanged: () => Promise<void>
}) {
  const [busId, setBusId] = useState('')
  const [period, setPeriod] = useState<Period>('all')

  const shown = useMemo(() => {
    const list = trips.filter(
      (t) => (!busId || t.fleetId === busId) && (period === 'all' || (period === 'finished' ? t.departed : !t.departed))
    )
    // Newest first, except trips still to come, which read soonest first.
    return period === 'upcoming' ? list : [...list].reverse()
  }, [trips, busId, period])
  const total = useMemo(() => addMoney(shown.map(companyTripMoney)), [shown])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={busId} onChange={(e) => setBusId(e.target.value)} className="input-dark sm:grow" aria-label="Bus">
          <option value="">All buses</option>
          {fleet.map((f) => (
            <option key={f._id} value={f._id}>
              {busLabel(f)}
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

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <MoneyCard m={total} trips={shown.length} />
        <StaffSales trips={shown} period={PERIOD_TEXT[period]} />
      </div>

      <div className="card-2 overflow-hidden">
        <div className="flex flex-col gap-0.5 border-b border-[#1a2123] px-4 py-3">
          <span className="label-xs">Trip by trip</span>
          <span className="text-[11px] text-[#6e7b7e]">Open a trip to see its money and add or check costs</span>
        </div>
        {shown.map((t) => (
          <TripRow key={t._id} trip={t} me={me} onChanged={onChanged} />
        ))}
        {shown.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No trips here.</div>}
      </div>

      <details className="group mt-1">
        <summary className="label-xs cursor-pointer list-none px-1 py-2 marker:hidden">
          <span className="group-open:hidden">Every BusHub ticket, all time ›</span>
          <span className="hidden group-open:inline">Every BusHub ticket, all time ‹</span>
        </summary>
        <div className="mt-2">
          <SalesBreakdown bookings={bookings} />
        </div>
      </details>
    </div>
  )
}
