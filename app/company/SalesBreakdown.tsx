'use client'

import { useMemo, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import Plate from '../Plate'

export interface SaleBooking {
  _id: string
  busId: string
  busName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  companyPayout: number
  bookingCode: string
  checkedIn?: boolean
  plateNumber?: string
  paymentStatus: string
  status: string
}

interface Trip {
  busId: string
  busName: string
  plateNumber: string
  from: string
  to: string
  date: string
  departureTime: string
  sold: SaleBooking[]
  refunded: SaleBooking[]
  seats: number
  payout: number
}

interface BusGroup {
  busName: string
  trips: Trip[]
  seats: number
  payout: number
}

const taka = (n: number) => `৳${n.toLocaleString('en-US')}`
const isSold = (b: SaleBooking) => b.paymentStatus === 'paid' && b.status === 'confirmed'

/** Newest trips first; on the same day, earlier departures first. */
function byTripTime(a: { date: string; departureTime: string }, b: { date: string; departureTime: string }) {
  return b.date.localeCompare(a.date) || a.departureTime.localeCompare(b.departureTime)
}

function TripRow({ trip, showBus }: { trip: Trip; showBus: boolean }) {
  return (
    <details className="group border-b border-[#c9d6e4] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:hidden">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          {showBus && <span className="truncate text-[13px] font-bold">{trip.busName}</span>}
          <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${showBus ? 'text-[12px] text-[#2f3f5a]' : 'text-[13px] font-semibold'}`}>
            <span>
              {trip.from} → {trip.to}
            </span>
            <Plate plate={trip.plateNumber} />
          </span>
          <span className="text-[11.5px] text-[#5a677d]">
            {formatTripDate(trip.date)} · {trip.departureTime}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[13px] font-bold text-[#0a8a84]">{taka(trip.payout)}</span>
          <span className="text-[11px] text-[#44526b]">
            {trip.seats} seat{trip.seats === 1 ? '' : 's'} · {trip.sold.length} ticket{trip.sold.length === 1 ? '' : 's'}
          </span>
          <span className="text-[10.5px] text-[#0b7f8c] group-open:hidden">Show tickets ›</span>
          <span className="hidden text-[10.5px] text-[#0b7f8c] group-open:inline">Hide tickets ‹</span>
        </div>
      </summary>
      <div className="flex flex-col gap-1.5 bg-white/60 px-4 pb-3 pt-1">
        {[...trip.sold, ...trip.refunded].map((b) => (
          <div key={b._id} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate">
              Seats {b.seats.join(', ')} <span className="font-mono text-[11px] text-[#5a677d]">· {b.bookingCode}</span>
              {b.checkedIn && <span className="text-[#0a8a84]"> · boarded</span>}
            </span>
            <span className={`shrink-0 font-semibold ${isSold(b) ? 'text-[#24344f]' : 'text-[#d23c3c]'}`}>
              {isSold(b) ? taka(b.companyPayout ?? b.totalPrice) : 'Refunded'}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

/**
 * The operator's online sales, split trip by trip or bus by bus, so they can see which
 * departure sold what and what BusHub owes for it.
 */
export default function SalesBreakdown({ bookings }: { bookings: SaleBooking[] }) {
  const [view, setView] = useState<'trip' | 'bus'>('trip')

  const trips = useMemo(() => {
    const map = new Map<string, Trip>()
    for (const b of bookings) {
      if (!isSold(b) && b.status !== 'refunded') continue // holds that were never paid are not sales
      const key = b.busId || `${b.busName}|${b.date}|${b.departureTime}`
      let trip = map.get(key)
      if (!trip) {
        trip = { busId: key, busName: b.busName, plateNumber: b.plateNumber || '', from: b.from, to: b.to, date: b.date, departureTime: b.departureTime, sold: [], refunded: [], seats: 0, payout: 0 }
        map.set(key, trip)
      }
      if (isSold(b)) {
        trip.sold.push(b)
        trip.seats += b.seats.length
        trip.payout += b.companyPayout ?? b.totalPrice
      } else {
        trip.refunded.push(b)
      }
    }
    return Array.from(map.values()).sort(byTripTime)
  }, [bookings])

  const buses = useMemo(() => {
    const map = new Map<string, BusGroup>()
    for (const trip of trips) {
      let bus = map.get(trip.busName)
      if (!bus) {
        bus = { busName: trip.busName, trips: [], seats: 0, payout: 0 }
        map.set(trip.busName, bus)
      }
      bus.trips.push(trip)
      bus.seats += trip.seats
      bus.payout += trip.payout
    }
    return Array.from(map.values()).sort((a, b) => b.payout - a.payout)
  }, [trips])

  if (trips.length === 0) {
    return <div className="card-2 px-4 py-8 text-center text-sm text-[#4f5d75]">No tickets sold yet.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 self-start rounded-full border border-[#0b2545]/10 bg-white/60 p-1">
        {(['trip', 'bus'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`h-9 rounded-full px-4 text-[12.5px] font-bold transition ${
              view === v ? 'bg-[#0b2545] text-[#ffffff]' : 'text-[#44526b]'
            }`}
          >
            {v === 'trip' ? 'By trip' : 'By bus'}
          </button>
        ))}
      </div>

      {view === 'trip' ? (
        <div className="card-2 overflow-hidden">
          {trips.map((trip) => (
            <TripRow key={trip.busId} trip={trip} showBus />
          ))}
        </div>
      ) : (
        buses.map((bus) => (
          <div key={bus.busName} className="card-2 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#c9d6e4] bg-[#0b2545]/[0.05] px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-bold">{bus.busName}</span>
                <span className="text-[11.5px] text-[#44526b]">
                  {bus.trips.length} trip{bus.trips.length === 1 ? '' : 's'} · {bus.seats} seat{bus.seats === 1 ? '' : 's'} sold
                </span>
              </div>
              <span className="shrink-0 text-[15px] font-bold text-[#0a8a84]">{taka(bus.payout)}</span>
            </div>
            {bus.trips.map((trip) => (
              <TripRow key={trip.busId} trip={trip} showBus={false} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
