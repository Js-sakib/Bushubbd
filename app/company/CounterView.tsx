'use client'

import { useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import SeatMap, { type SeatKind } from './SeatMap'
import TripForm from './TripForm'
import TripPicker from './TripPicker'
import { changeSeat, useTrips } from './useTrips'
import { tripCounts } from './types'
import toast from 'react-hot-toast'
import Plate from '../Plate'

const TABS = [
  ['sell', 'Sell seats'],
  ['add', 'Add trip'],
] as const

/**
 * The counter login's page. Pick the bus and trip, then tap a seat the moment it is sold at the
 * counter; it comes off sale on bushubbd.com at once, and the manager sees it. Tapping a seat you
 * sold frees it again. Seats sold online, or by another counter, can't be touched from here.
 */
export default function CounterView() {
  const { data, reload } = useTrips()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('sell')
  const [busId, setBusId] = useState('')
  const [tripId, setTripId] = useState<string | null>(null)
  const [busySeat, setBusySeat] = useState<string | null>(null)

  const trips = data?.trips ?? []
  const trip = trips.find((t) => t._id === tripId) || null
  useEffect(() => {
    if (tripId && data && !trip) setTripId(null)
  }, [tripId, data, trip])

  const tap = async (seat: string, kind: SeatKind) => {
    if (!trip) return
    if (kind === 'online') return toast(`Seat ${seat} is sold on BusHub.`)
    if (kind === 'held') return toast(`Someone is buying seat ${seat} online right now.`)
    if (kind === 'counter') {
      const sale = trip.counterSeats.find((c) => c.seat === seat)
      return toast(`Seat ${seat} was sold by ${sale?.soldBy || 'another counter'}.`)
    }
    if (kind === 'mine' && !confirm(`Free seat ${seat} again? It goes back on sale online.`)) return
    setBusySeat(seat)
    await changeSeat(trip, seat, kind === 'free' ? 'sell' : 'unsell')
    await reload()
    setBusySeat(null)
  }

  if (!data) return <div className="py-16 text-center text-sm text-[#4f5d75]">Loading trips...</div>
  const c = trip ? tripCounts(trip) : null
  const mine = trip ? trip.counterSeats.filter((s) => s.staffId === data.me.staffId).map((s) => s.seat) : []

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`chip ${tab === id ? 'chip-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'add' && (
        <TripForm
          fleet={data.fleet}
          cities={data.cities}
          trips={trips}
          onCreated={async (id) => {
            await reload()
            setTripId(id)
            setTab('sell')
          }}
        />
      )}

      {tab === 'sell' && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
          <TripPicker fleet={data.fleet} trips={trips} busId={busId} onBus={setBusId} tripId={tripId} onTrip={setTripId} />
          {trip && c && (
            <div className="glass-lite flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 display text-[17px] font-bold">
                  <span className="truncate">
                    {trip.from} → {trip.to} · {trip.departureTime}
                  </span>
                  <Plate plate={trip.plateNumber} />
                </span>
                <span className="text-[12px] text-[#44526b]">
                  {formatTripDate(trip.date)} · {trip.busName} · ৳{trip.price}
                  {trip.boardingPoint ? ` · ${trip.boardingPoint}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/60 py-2">
                  <div className="display text-[18px] font-bold text-[#0a8a84]">{c.free}</div>
                  <div className="text-[10.5px] text-[#4f5d75]">Free</div>
                </div>
                <div className="rounded-xl bg-white/60 py-2">
                  <div className="display text-[18px] font-bold text-[#0b7f8c]">{c.online + c.held}</div>
                  <div className="text-[10.5px] text-[#4f5d75]">BusHub</div>
                </div>
                <div className="rounded-xl bg-white/60 py-2">
                  <div className="display text-[18px] font-bold text-[#2d7886]">{c.counter}</div>
                  <div className="text-[10.5px] text-[#4f5d75]">Counter</div>
                </div>
              </div>
              <p className="text-[12px] text-[#24344f]">Tap a free seat as soon as you sell it. Tap your own purple seat to undo.</p>
              <SeatMap trip={trip} myStaffId={data.me.staffId} busySeat={busySeat} onTap={tap} />
              {mine.length > 0 && (
                <p className="text-[12px] text-[#24344f]">
                  You sold <b>{mine.length}</b> on this trip: {mine.join(', ')}
                </p>
              )}
            </div>
          )}
          {!trip && (
            <div className="glass-lite hidden flex-col items-center justify-center gap-1 p-10 text-center lg:flex">
              <span className="display text-[16px] font-bold">Choose a trip</span>
              <span className="text-[12.5px] text-[#44526b]">Its seats show here. Tap a free seat as soon as you sell it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
