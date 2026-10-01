'use client'

import { useMemo } from 'react'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import type { CompanyTrip } from './types'

interface SellerTrip {
  trip: CompanyTrip
  seats: string[]
}

interface Seller {
  name: string
  seats: number
  today: number
  value: number
  trips: SellerTrip[]
}

const taka = (n: number) => `৳${n.toLocaleString('en-US')}`

/**
 * Who sold the seats: BusHub online, then each counter login with its seats today, in total and
 * trip by trip. Covers the trips the manager page loads: upcoming ones and the last 30 days.
 */
export default function StaffSales({ trips }: { trips: CompanyTrip[] }) {
  const { online, sellers } = useMemo(() => {
    const today = dhakaDate()
    const map = new Map<string, Seller>()
    let online = 0
    for (const trip of trips) {
      online += trip.onlineSeats.length
      for (const sale of trip.counterSeats) {
        const key = sale.staffId || `name:${sale.soldBy}`
        let seller = map.get(key)
        if (!seller) {
          seller = { name: sale.soldBy, seats: 0, today: 0, value: 0, trips: [] }
          map.set(key, seller)
        }
        seller.seats += 1
        seller.value += trip.price
        if (sale.soldAt && dhakaDate(new Date(sale.soldAt)) === today) seller.today += 1
        const row = seller.trips.find((t) => t.trip._id === trip._id)
        if (row) row.seats.push(sale.seat)
        else seller.trips.push({ trip, seats: [sale.seat] })
      }
    }
    const sellers = Array.from(map.values()).sort((a, b) => b.seats - a.seats)
    for (const s of sellers) s.trips.sort((a, b) => b.trip.date.localeCompare(a.trip.date) || a.trip.departureTime.localeCompare(b.trip.departureTime))
    return { online, sellers }
  }, [trips])

  return (
    <div className="card-2 overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-[#1a2123] px-4 py-3">
        <span className="label-xs">Who sold seats</span>
        <span className="text-[11px] text-[#6e7b7e]">Upcoming trips and the last 30 days</span>
      </div>

      <div className="flex items-center gap-3 border-b border-[#1a2123] px-4 py-3">
        <div className="flex min-w-0 grow flex-col">
          <span className="text-[13.5px] font-semibold text-[#f5a524]">BusHub online</span>
          <span className="text-[11.5px] text-[#78868a]">Tickets bought on bushubbd.com</span>
        </div>
        <span className="display shrink-0 text-[20px] font-bold">{online}</span>
      </div>

      {sellers.map((s, i) => (
        <details key={`${s.name}-${i}`} className="group border-b border-[#1a2123] last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden">
            <div className="flex min-w-0 grow flex-col">
              <span className="truncate text-[13.5px] font-semibold text-[#c4b5fd]">{s.name}</span>
              <span className="text-[11.5px] text-[#78868a]">
                {s.seats} seat{s.seats === 1 ? '' : 's'} · {taka(s.value)} at ticket price
              </span>
              <span className="text-[10.5px] text-[#f5a524] group-open:hidden">Show trips ›</span>
              <span className="hidden text-[10.5px] text-[#f5a524] group-open:inline">Hide trips ‹</span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="display text-[20px] font-bold leading-none text-[#a78bfa]">{s.today}</span>
              <span className="text-[10.5px] text-[#8e9a9d]">today</span>
            </div>
          </summary>
          <div className="flex flex-col gap-1.5 bg-black/20 px-4 pb-3 pt-1">
            {s.trips.map(({ trip, seats }) => (
              <div key={trip._id} className="flex items-start justify-between gap-3 text-[12px]">
                <span className="min-w-0">
                  {trip.from} → {trip.to}
                  <span className="text-[#78868a]">
                    {' '}
                    · {formatTripDate(trip.date)} · {trip.departureTime} · {trip.busName}
                  </span>
                </span>
                <span className="max-w-[45%] shrink-0 text-right font-semibold text-[#c4cdcf]">
                  {seats.length} · {seats.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}

      {sellers.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-[#8e9a9d]">No seats sold at the counter yet.</div>
      )}
    </div>
  )
}
