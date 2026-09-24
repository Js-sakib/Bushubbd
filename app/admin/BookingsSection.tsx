'use client'

import { useMemo, useState } from 'react'
import BookingList, { bookingStatus } from './BookingList'
import type { Booking } from './types'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'boarded', label: 'Boarded' },
  { key: 'pending', label: 'Pending' },
  { key: 'refunded', label: 'Refunded' },
] as const

export default function BookingsSection({
  bookings,
  query,
  onQuery,
  onRefund,
}: {
  bookings: Booking[]
  query: string
  onQuery: (q: string) => void
  onRefund: (id: string) => void
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      if (filter !== 'all' && bookingStatus(b) !== filter) return false
      if (!q) return true
      return [b.passengerName, b.passengerPhone, b.bookingCode, b.from, b.to, b.busName, b.companyName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    })
  }, [bookings, filter, query])

  return (
    <section className="glass flex flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[15.5px] font-bold">All bookings</h2>
          <span className="text-[11.5px] text-[#78868a]">
            {visible.length} of {bookings.length}
            {bookings.length >= 200 ? ' latest' : ''}
          </span>
        </div>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e7b7e]">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name, phone, booking code, route"
            aria-label="Search bookings"
            className="input-dark w-full !pl-10"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`chip shrink-0 ${filter === f.key ? 'chip-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <BookingList bookings={visible} onRefund={onRefund} empty={query || filter !== 'all' ? 'No bookings match.' : 'No bookings yet.'} />
    </section>
  )
}
