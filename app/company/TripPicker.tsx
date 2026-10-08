'use client'

import { formatTripDate } from '@/lib/dates'
import { useState } from 'react'
import { busLabel, tripCounts, tripSearchText, type CompanyTrip, type FleetOption } from './types'
import SearchBox from '../SearchBox'
import { matches } from '@/lib/search'
import Plate from '../Plate'
import { dhakaDate } from '@/lib/scan'

const DAYS = [
  ['today', 'Today'],
  ['tomorrow', 'Tomorrow'],
  ['all', 'All days'],
] as const

/** Bus drop-down, then the trips of that bus as cards to pick from. */
export default function TripPicker({
  fleet,
  trips,
  busId,
  onBus,
  tripId,
  onTrip,
}: {
  fleet: FleetOption[]
  trips: CompanyTrip[]
  busId: string
  onBus: (id: string) => void
  tripId: string | null
  onTrip: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [day, setDay] = useState<(typeof DAYS)[number][0]>('all')
  const today = dhakaDate()
  const tomorrow = dhakaDate(new Date(Date.now() + 86_400_000))
  const onDay = (t: CompanyTrip) => (day === 'today' ? t.date === today : day === 'tomorrow' ? t.date === tomorrow : true)
  // Soonest first, so the next bus to leave is at the top.
  const shown = trips
    .filter((t) => (!busId || t.fleetId === busId) && onDay(t) && matches(search, tripSearchText(t)))
    .sort((a, b) => `${a.date} ${a.departureTime}`.localeCompare(`${b.date} ${b.departureTime}`))
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search route, number plate, time, date" />
      <div className="flex gap-2" role="group" aria-label="Day">
        {DAYS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setDay(id)} aria-pressed={day === id} className={`chip ${day === id ? 'chip-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>
      <select value={busId} onChange={(e) => onBus(e.target.value)} className="input-dark" aria-label="Bus">
        <option value="">All buses</option>
        {fleet.map((f) => (
          <option key={f._id} value={f._id}>
            {busLabel(f)}
          </option>
        ))}
      </select>
      {shown.length === 0 && <p className="glass-lite p-4 text-center text-[13px] text-[#4a4a4a]">{search ? 'No trips match your search.' : day === 'all' ? 'No upcoming trips for this bus.' : `No trips ${day}.`}</p>}
      <div className="flex flex-col gap-2">
        {shown.map((t) => {
          const c = tripCounts(t)
          const active = t._id === tripId
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => onTrip(t._id)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                active ? 'border-[#cc8b65] bg-[#feb249]/[0.08]' : 'border-[#111111]/10 bg-white/60 hover:bg-[#111111]/[0.05]'
              }`}
            >
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold">
                  <span className="truncate">
                    {t.from} → {t.to} · {t.departureTime}
                  </span>
                  <Plate plate={t.plateNumber} />
                </span>
                <span className="truncate text-[11.5px] text-[#3f3f3f]">
                  {formatTripDate(t.date)} · {t.busName}
                </span>
              </div>
              <span className="shrink-0 text-right text-[11.5px] leading-tight">
                <b className="text-[14px] text-[#0a8a84]">{c.free}</b>
                <span className="text-[#4a4a4a]"> free</span>
                <br />
                <span className="text-[#4a4a4a]">of {t.totalSeats}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
