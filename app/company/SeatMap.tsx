'use client'

import { generateSeatLabels } from '@/lib/seats'
import type { CompanyTrip } from './types'

export type SeatKind = 'free' | 'online' | 'held' | 'counter' | 'mine'

const STYLES: Record<SeatKind, string> = {
  free: 'border border-[#2a6b52] bg-[#12372c] text-[#7de3b8] hover:border-[#34d399]',
  online: 'border border-[#f5a524] bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#170b02]',
  held: 'border border-dashed border-[#f5a524] bg-[#f5a524]/[0.08] text-[#f5a524]',
  counter: 'border border-[#8b6dff] bg-[#5b3fd6] text-white',
  mine: 'border-2 border-white bg-[#6d4aff] text-white',
}

export const SEAT_LEGEND: { kind: SeatKind; label: string }[] = [
  { kind: 'free', label: 'Free' },
  { kind: 'online', label: 'Sold on BusHub' },
  { kind: 'held', label: 'Being bought online' },
  { kind: 'counter', label: 'Sold at counter' },
]

/** What every seat of a trip is: free, sold on BusHub, being bought online, or sold at a counter. */
export function seatKinds(trip: CompanyTrip, myStaffId?: string | null): Map<string, SeatKind> {
  const map = new Map<string, SeatKind>()
  for (const seat of generateSeatLabels(trip.totalSeats)) map.set(seat, 'free')
  for (const seat of trip.heldSeats) map.set(seat, 'held')
  for (const seat of trip.onlineSeats) map.set(seat, 'online')
  for (const c of trip.counterSeats) map.set(c.seat, myStaffId && c.staffId === myStaffId ? 'mine' : 'counter')
  return map
}

/** The bus seen from above, two seats each side of the aisle, like the booking page. */
export default function SeatMap({
  trip,
  myStaffId,
  busySeat,
  onTap,
}: {
  trip: CompanyTrip
  myStaffId?: string | null
  busySeat?: string | null
  onTap?: (seat: string, kind: SeatKind) => void
}) {
  const kinds = seatKinds(trip, myStaffId)
  const labels = generateSeatLabels(trip.totalSeats)
  const rows: string[][] = []
  for (let i = 0; i < labels.length; i += 4) rows.push(labels.slice(i, i + 4))

  const seatButton = (seat: string) => {
    const kind = kinds.get(seat) || 'free'
    return (
      <button
        key={seat}
        type="button"
        disabled={!onTap || busySeat === seat}
        onClick={() => onTap?.(seat, kind)}
        aria-label={`Seat ${seat}`}
        className={`h-10 min-w-0 grow basis-0 rounded-[10px] text-[12px] font-bold transition disabled:cursor-default ${STYLES[kind]} ${
          busySeat === seat ? 'animate-pulse' : ''
        }`}
      >
        {seat}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {SEAT_LEGEND.map((l) => (
          <span key={l.kind} className="flex items-center gap-1.5 text-[11px] text-[#9ba7aa]">
            <span className={`h-3 w-3 rounded-[4px] ${STYLES[l.kind]}`} />
            {l.label}
          </span>
        ))}
        {myStaffId && (
          <span className="flex items-center gap-1.5 text-[11px] text-[#9ba7aa]">
            <span className={`h-3 w-3 rounded-[4px] ${STYLES.mine}`} />
            Sold by you
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-black/25 p-3">
        <div className="flex justify-end pb-1 text-[10.5px] font-bold uppercase tracking-wide text-[#6e7b7e]">Driver</div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-[10.5px] font-bold text-[#6e7b7e]">{i + 1}</span>
            {row.slice(0, 2).map(seatButton)}
            <span className="w-4 shrink-0" />
            {row.slice(2, 4).map(seatButton)}
          </div>
        ))}
      </div>
    </div>
  )
}
