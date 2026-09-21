'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatTripDate } from '@/lib/dates'

interface Bus {
  _id: string
  companyName: string
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  arrivalTime: string
  price: number
  totalSeats: number
  bookedSeats: string[]
}

const TYPE_FILTERS = ['All', 'AC', 'Non-AC', 'Sleeper']

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const date = searchParams.get('date') || ''

  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => {
    if (!from || !to || !date) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setBuses(data.buses || [])
      })
      .catch(() => setError('Failed to load buses'))
      .finally(() => setLoading(false))
  }, [from, to, date])

  const visible = typeFilter === 'All' ? buses : buses.filter((bus) => bus.busType === typeFilter)

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/')} aria-label="Back to search" className="icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M19 12H6" />
            <path d="m11.5 5.5-6 6.5 6 6.5" />
          </svg>
        </button>
        <div className="flex grow flex-col gap-0.5">
          <span className="display text-[17px] font-bold">
            {from} → {to}
          </span>
          <span className="text-xs text-[#8e9a9d]">{formatTripDate(date)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setTypeFilter(filter)}
            className={`chip ${typeFilter === filter ? 'chip-active' : ''}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-sm text-[#8e9a9d]">Searching buses...</div>}

      {!loading && error && <div className="py-16 text-center text-sm text-[#f87171]">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="card mt-5 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1c2426] text-[#8e9a9d]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <rect x="3" y="4" width="18" height="12.5" rx="3" />
              <path d="M3 11h18" />
              <circle cx="7.5" cy="19" r="1.6" />
              <circle cx="16.5" cy="19" r="1.6" />
            </svg>
          </span>
          <h2 className="text-lg font-bold">No buses found</h2>
          <p className="text-[13px] text-[#9ba7aa]">Try a different date or route.</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {visible.map((bus) => {
          const seatsLeft = bus.totalSeats - (bus.bookedSeats?.length || 0)
          const soldOut = seatsLeft <= 0
          const scarce = seatsLeft > 0 && seatsLeft <= 5

          return (
            <div
              key={bus._id}
              className={`flex flex-col gap-3.5 rounded-[18px] border bg-[#151b1d] p-4 ${soldOut ? 'border-[#222b2e] opacity-60' : 'border-[#222b2e]'}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-[#f5a524]/[0.13] text-[#f5a524]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[21px] w-[21px]">
                    <rect x="3" y="4" width="18" height="12.5" rx="3" />
                    <path d="M3 11h18" />
                    <circle cx="7.5" cy="19" r="1.6" />
                    <circle cx="16.5" cy="19" r="1.6" />
                  </svg>
                </span>
                <div className="flex grow flex-col gap-1">
                  <span className="text-[15px] font-bold">{bus.busName}</span>
                  <span className="text-xs text-[#8e9a9d]">
                    {bus.companyName} · {bus.busType} · {bus.totalSeats} seats
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="display text-[19px] font-bold text-[#f5a524]">৳{bus.price}</span>
                  <span className="text-[11px] text-[#8e9a9d]">per seat</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold">{bus.departureTime}</span>
                  <span className="text-[11px] text-[#8e9a9d]">{bus.from}</span>
                </div>
                <div className="flex grow items-center gap-1.5">
                  <span className="h-px grow bg-[#2c3639]" />
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <rect x="3" y="4" width="18" height="12.5" rx="3" />
                    <path d="M3 11h18" />
                  </svg>
                  <span className="h-px grow bg-[#2c3639]" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[15px] font-bold">{bus.arrivalTime || '—'}</span>
                  <span className="text-[11px] text-[#8e9a9d]">{bus.to}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {soldOut ? (
                  <span className="inline-flex h-[26px] items-center rounded-full bg-white/[0.07] px-2.5 text-[11.5px] font-bold text-[#c4cdcf]">
                    Sold out
                  </span>
                ) : (
                  <span
                    className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-bold ${
                      scarce ? 'bg-[#f5a524]/[0.13] text-[#f5a524]' : 'bg-[#34d399]/[0.13] text-[#34d399]'
                    }`}
                  >
                    {seatsLeft} seats left
                  </span>
                )}

                {!soldOut && (
                  <button
                    type="button"
                    onClick={() => router.push(`/booking?busId=${bus._id}`)}
                    className="glass-btn ml-auto h-[42px] px-5 text-sm"
                  >
                    <span className="icon-disc h-6 w-6">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <path d="M5 12h13" />
                        <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
                      </svg>
                    </span>
                    Select seats
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && visible.length > 0 && (
        <p className="mt-6 text-center text-[11.5px] text-[#78868a]">Prices shown are per seat, all taxes included.</p>
      )}
    </div>
  )
}

export default function Search() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>}>
      <SearchResults />
    </Suspense>
  )
}
