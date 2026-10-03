'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import { taka, type TripCost } from '@/lib/tripMoney'
import CostEditor from './CostEditor'
import Plate from '../Plate'

interface CostTrip {
  _id: string
  busName: string
  plateNumber: string
  from: string
  to: string
  date: string
  departureTime: string
  departed: boolean
}

interface CostsData {
  me: { name: string; role: string; staffId: string | null }
  trips: CostTrip[]
  costs: TripCost[]
}

/** The trip that is most likely "this one": the last to leave today, else the next to leave. */
function likelyTrip(trips: CostTrip[]): string {
  const today = dhakaDate()
  const left = trips.filter((t) => t.date === today && t.departed)
  return (left[left.length - 1] || trips.find((t) => !t.departed) || trips[trips.length - 1])?._id || ''
}

/** The bus staff's costs page: pick the trip, then add fuel, road, toll and other costs. */
export default function StaffCosts() {
  const [data, setData] = useState<CostsData | null>(null)
  const [tripId, setTripId] = useState('')

  const load = useCallback(async () => {
    const d = await fetch('/api/company/costs', { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null)
    if (d?.trips) {
      setData(d)
      setTripId((current) => current || likelyTrip(d.trips))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>
  if (data.trips.length === 0) {
    return <p className="glass-lite mt-5 p-5 text-center text-[13px] text-[#4a4a4a]">No trips yesterday, today or tomorrow.</p>
  }

  const today = dhakaDate()
  const trip = data.trips.find((t) => t._id === tripId)
  const costs = data.costs.filter((c) => c.busId === tripId)
  const label = (t: CostTrip) => `${t.date === today ? 'Today' : formatTripDate(t.date)} · ${t.departureTime} · ${t.from} → ${t.to} · ${t.busName}`

  return (
    <div className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label-xs">Which trip?</span>
        <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="input-dark" aria-label="Trip">
          {data.trips.map((t) => (
            <option key={t._id} value={t._id}>
              {label(t)}
            </option>
          ))}
        </select>
      </label>

      {trip && (
        <div className="card-2 flex flex-col gap-4 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold">
                <span className="truncate">
                  {trip.from} → {trip.to} · {trip.departureTime}
                </span>
                <Plate plate={trip.plateNumber} />
              </span>
              <span className="truncate text-[11.5px] text-[#3f3f3f]">
                {formatTripDate(trip.date)} · {trip.busName}
              </span>
            </div>
            <span className="shrink-0 text-right text-[11px] text-[#3f3f3f]">
              {costs.length} cost{costs.length === 1 ? '' : 's'}
              <br />
              <span className="text-[14px] font-bold text-[#c13b3b]">{taka(costs.reduce((n, c) => n + c.amount, 0))}</span>
            </span>
          </div>
          <CostEditor tripId={trip._id} costs={costs} me={data.me} onChanged={load} />
        </div>
      )}

      <p className="rounded-2xl border border-[#c3d1e0] bg-white/70 px-4 py-3 text-[12px] leading-relaxed text-[#303030]">
        Your manager sees every cost you add. Made a mistake? You can remove your own cost within an hour; after that, ask your
        manager.
      </p>
    </div>
  )
}
