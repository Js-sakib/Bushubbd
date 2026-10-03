'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { generateSeatLabels, seatsLeft } from '@/lib/seats'

interface SeatBus {
  _id: string
  busName: string
  from: string
  to: string
  date: string
  totalSeats: number
  bookedSeats?: string[]
  blockedSeats?: string[]
}

interface SeatBooking {
  busId: string
  seats: string[]
  status: string
}

export default function SeatManager({
  bus,
  bookings,
  onChange,
}: {
  bus: SeatBus
  bookings: SeatBooking[]
  onChange: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  // Only a seat a live booking claims is really sold on BusHub. Anything else sitting in
  // bookedSeats was marked by hand before counter sales had their own list, so it stays editable.
  const sold = bookings
    .filter((b) => b.busId === bus._id && (b.status === 'pending' || b.status === 'confirmed'))
    .flatMap((b) => b.seats || [])
  const blocked = Array.from(
    new Set([...(bus.blockedSeats || []), ...(bus.bookedSeats || []).filter((s) => !sold.includes(s))])
  )
  const free = seatsLeft(bus)

  const toggleSeat = async (seatLabel: string) => {
    // A seat sold through BusHub belongs to a paying passenger — never editable here.
    if (sold.includes(seatLabel)) {
      toast.error(`Seat ${seatLabel} is sold on BusHub. Refund that ticket to free it.`)
      return
    }
    const isBlocked = blocked.includes(seatLabel)
    setBusy(seatLabel)
    try {
      const res = await fetch(`/api/buses/${bus._id}/seats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: [seatLabel], action: isBlocked ? 'unblock' : 'block' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update seat')
        return
      }
      onChange()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card-2 flex flex-col gap-4 p-5">
      <div>
        <h3 className="display text-[15px] font-bold">
          {bus.busName} · {bus.from} → {bus.to} ({bus.date})
        </h3>
        <p className="mt-1 text-[12.5px] text-[#44526b]">
          Tap a seat to mark it <strong className="text-[#0b7f8c]">sold at your counter</strong>, tap again to put it
          back on sale. Seats sold on BusHub are locked — refund the ticket to free one.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
        <span className="rounded-full bg-[#3fd0c9]/[0.13] px-3 py-1 text-[#0a8a84]">{free} available</span>
        <span className="rounded-full bg-[#feb249]/[0.13] px-3 py-1 text-[#0b7f8c]">{blocked.length} sold at counter</span>
        <span className="rounded-full bg-[#f87171]/[0.13] px-3 py-1 text-[#d23c3c]">{sold.length} sold on BusHub</span>
      </div>

      <div className="grid max-w-2xl grid-cols-8 gap-2 sm:grid-cols-12">
        {generateSeatLabels(bus.totalSeats).map((seatLabel) => {
          const isSold = sold.includes(seatLabel)
          const isBlocked = blocked.includes(seatLabel)
          const state = isSold
            ? 'cursor-not-allowed border border-[#eba9a9] bg-[#fde4e4] text-[#b84a46]'
            : isBlocked
              ? 'border border-[#e2b860] bg-[#fff1d6] text-[#8a6d00] hover:bg-[#fff1d6]'
              : 'border border-[#0dabab] bg-[#dff6f5] text-[#0a6f72] hover:bg-[#dff6f5]'
          return (
            <button
              key={seatLabel}
              type="button"
              disabled={isSold || busy === seatLabel}
              onClick={() => toggleSeat(seatLabel)}
              title={isSold ? 'Sold on BusHub — refund to free' : isBlocked ? 'Sold at counter — tap to put back on sale' : 'Available — tap to mark sold at counter'}
              className={`h-9 rounded-lg text-[11.5px] font-bold transition disabled:opacity-70 ${state}`}
            >
              {seatLabel}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-[12.5px] text-[#24344f]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded border border-[#0dabab] bg-[#dff6f5]" />
          Available now
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded border border-[#e2b860] bg-[#fff1d6]" />
          Sold at counter
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded border border-[#eba9a9] bg-[#fde4e4]" />
          Sold on BusHub (locked)
        </span>
      </div>
    </div>
  )
}
