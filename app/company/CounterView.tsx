'use client'

import { useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import SeatMap, { seatKinds, type SeatKind } from './SeatMap'
import TripForm from './TripForm'
import TripPicker from './TripPicker'
import { changeSeat, useTrips } from './useTrips'
import { tripCounts, type CompanyTrip } from './types'
import toast from 'react-hot-toast'
import Plate from '../Plate'

function dhakaTime(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** The seats behind a tapped number: which are free, which sold online, and who sold which at the counter. */
function SeatDetail({ trip, kind, myStaffId }: { trip: CompanyTrip; kind: 'free' | 'online' | 'counter'; myStaffId: string | null }) {
  const kinds = seatKinds(trip, myStaffId)
  const of = (...want: SeatKind[]) => Array.from(kinds).filter(([, k]) => want.includes(k)).map(([s]) => s)
  const box = 'flex flex-col gap-2 rounded-2xl border border-[#f2661d]/30 bg-white/80 px-3.5 py-3 text-[12.5px]'
  if (kind === 'free') {
    const free = of('free')
    return (
      <div className={box}>
        <span className="font-bold">{free.length} free seats, outlined on the map</span>
        <span className="leading-relaxed text-[#3f3f3f]">{free.join(', ') || 'None: the bus is full.'}</span>
      </div>
    )
  }
  if (kind === 'online') {
    const sold = of('online')
    const held = of('held')
    return (
      <div className={box}>
        <span className="font-bold">{sold.length} sold on BusHub</span>
        <span className="text-[#3f3f3f]">{sold.join(', ') || 'None yet.'}</span>
        {held.length > 0 && <span className="text-[#3f3f3f]">Being bought online right now: {held.join(', ')}</span>}
      </div>
    )
  }
  const bySeller = new Map<string, { seats: string[]; last: string | null }>()
  for (const s of trip.counterSeats) {
    const row = bySeller.get(s.soldBy) || { seats: [], last: null }
    row.seats.push(s.seat)
    if (s.soldAt && (!row.last || s.soldAt > row.last)) row.last = s.soldAt
    bySeller.set(s.soldBy, row)
  }
  return (
    <div className={box}>
      <span className="font-bold">{trip.counterSeats.length} sold at the counter</span>
      {bySeller.size === 0 && <span className="text-[#3f3f3f]">None yet.</span>}
      {Array.from(bySeller).map(([seller, row]) => (
        <div key={seller} className="flex items-start justify-between gap-3">
          <span className="font-semibold">{seller}</span>
          <span className="text-right text-[#3f3f3f]">
            {row.seats.length} · {row.seats.join(', ')}
            {row.last && <span className="block text-[11px] text-[#5e5e5e]">last at {dhakaTime(row.last)}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

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
  // Tapping Free, BusHub or Counter lists those seats and outlines them on the map.
  const [detail, setDetail] = useState<'free' | 'online' | 'counter' | null>(null)
  useEffect(() => setDetail(null), [tripId])

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

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading trips...</div>
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
                <span className="text-[12px] text-[#3f3f3f]">
                  {formatTripDate(trip.date)} · {trip.busName} · ৳{trip.price}
                  {trip.boardingPoint ? ` · ${trip.boardingPoint}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ['free', c.free, 'Free', 'bg-[#002447] text-[#fbeceb] shadow-[0_8px_20px_rgba(0,36,71,0.28)]'],
                    ['online', c.online + c.held, 'BusHub', 'bg-[#53d3d1] text-[#002447] shadow-[0_8px_20px_rgba(83,211,209,0.4)]'],
                    ['counter', c.counter, 'Counter', 'border border-[#002447]/10 bg-[#fbeceb] text-[#002447] shadow-[0_8px_20px_rgba(0,36,71,0.12)]'],
                  ] as const
                ).map(([id, n, label, tone]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetail(detail === id ? null : id)}
                    aria-pressed={detail === id}
                    className={`rounded-xl py-2 transition hover:-translate-y-0.5 ${tone} ${
                      detail === id ? '!shadow-[0_10px_26px_rgba(242,102,29,0.45)] ring-[3px] ring-[#f2661d] ring-offset-2 ring-offset-transparent' : ''
                    }`}
                  >
                    <div className="display text-[18px] font-bold">{n}</div>
                    <div className="text-[10.5px] font-semibold opacity-85">{label} · Details ›</div>
                  </button>
                ))}
              </div>
              {detail && <SeatDetail trip={trip} kind={detail} myStaffId={data.me.staffId} />}
              <p className="text-[12px] text-[#222222]">Tap a free seat as soon as you sell it. Tap your own purple seat to undo.</p>
              <SeatMap
                trip={trip}
                myStaffId={data.me.staffId}
                busySeat={busySeat}
                onTap={tap}
                highlight={detail === 'free' ? ['free'] : detail === 'online' ? ['online', 'held'] : detail === 'counter' ? ['counter', 'mine'] : []}
              />
              {mine.length > 0 && (
                <p className="text-[12px] text-[#222222]">
                  You sold <b>{mine.length}</b> on this trip: {mine.join(', ')}
                </p>
              )}
            </div>
          )}
          {!trip && (
            <div className="glass-lite hidden flex-col items-center justify-center gap-1 p-10 text-center lg:flex">
              <span className="display text-[16px] font-bold">Choose a trip</span>
              <span className="text-[12.5px] text-[#3f3f3f]">Its seats show here. Tap a free seat as soon as you sell it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
