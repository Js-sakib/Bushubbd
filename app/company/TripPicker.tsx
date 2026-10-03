'use client'

import { formatTripDate } from '@/lib/dates'
import { busLabel, tripCounts, type CompanyTrip, type FleetOption } from './types'
import Plate from '../Plate'

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
  const shown = trips.filter((t) => !busId || t.fleetId === busId)
  return (
    <div className="flex flex-col gap-3">
      <select value={busId} onChange={(e) => onBus(e.target.value)} className="input-dark" aria-label="Bus">
        <option value="">All buses</option>
        {fleet.map((f) => (
          <option key={f._id} value={f._id}>
            {busLabel(f)}
          </option>
        ))}
      </select>
      {shown.length === 0 && <p className="glass-lite p-4 text-center text-[13px] text-[#8e9a9d]">No upcoming trips for this bus.</p>}
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
                active ? 'border-[#f5a524] bg-[#f5a524]/[0.08]' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold">
                  <span className="truncate">
                    {t.from} → {t.to} · {t.departureTime}
                  </span>
                  <Plate plate={t.plateNumber} />
                </span>
                <span className="truncate text-[11.5px] text-[#9ba7aa]">
                  {formatTripDate(t.date)} · {t.busName}
                </span>
              </div>
              <span className="shrink-0 text-right text-[11.5px] leading-tight">
                <b className="text-[14px] text-[#34d399]">{c.free}</b>
                <span className="text-[#8e9a9d]"> free</span>
                <br />
                <span className="text-[#8e9a9d]">of {t.totalSeats}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
