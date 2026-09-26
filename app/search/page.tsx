'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatTripDate } from '@/lib/dates'
import { seatsLeft as calcSeatsLeft } from '@/lib/seats'
import {
  BusFilters,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  SortKey,
  applyFilters,
  countActiveFilters,
  sortBuses,
} from '@/lib/busFilters'
import BusCard, { SearchBus } from './BusCard'
import { FiltersSheet, SortSheet } from './FilterSheet'

type Leg = 'outbound' | 'return'

function useLegBuses(from: string, to: string, date: string, enabled: boolean) {
  const [buses, setBuses] = useState<SearchBus[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !from || !to || !date) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) setError(data.error)
        else setBuses(data.buses || [])
      })
      .catch(() => !cancelled && setError('Failed to load buses'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to, date, enabled])

  return { buses, loading, error }
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const date = searchParams.get('date') || ''
  const isRoundTrip = searchParams.get('trip') === 'round'
  const returnDate = searchParams.get('returnDate') || ''
  const passengers = Math.min(6, Math.max(1, Number(searchParams.get('passengers')) || 1))

  const [leg, setLeg] = useState<Leg>('outbound')
  const [outboundPick, setOutboundPick] = useState<SearchBus | null>(null)
  const [returnPick, setReturnPick] = useState<SearchBus | null>(null)

  const [sort, setSort] = useState<SortKey>('cheapest')
  const [filters, setFilters] = useState<BusFilters>(EMPTY_FILTERS)
  const [sheet, setSheet] = useState<'sort' | 'filters' | null>(null)

  const outbound = useLegBuses(from, to, date, true)
  const inbound = useLegBuses(to, from, returnDate, isRoundTrip && Boolean(returnDate))

  const current = leg === 'return' ? inbound : outbound
  const currentPick = leg === 'return' ? returnPick : outboundPick

  // A bus that cannot seat the whole group is not a result worth showing.
  const roomy = useMemo(
    () => current.buses.filter((bus) => calcSeatsLeft(bus) >= passengers),
    [current.buses, passengers]
  )
  const tooSmall = current.buses.length - roomy.length

  // Each leg has its own operators and price band, so the filter sheet follows the visible leg.
  const operators = useMemo(() => Array.from(new Set(roomy.map((b) => b.companyName))).sort(), [roomy])
  const types = useMemo(() => Array.from(new Set(roomy.map((b) => b.busType))).sort(), [roomy])
  const priceRange = useMemo(() => {
    if (roomy.length === 0) return { min: 0, max: 0 }
    const prices = roomy.map((b) => b.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [roomy])

  const visible = useMemo(() => sortBuses(applyFilters(roomy, filters), sort), [roomy, filters, sort])
  const cheapestPrice = visible.length ? Math.min(...visible.map((b) => b.price)) : null
  const activeFilters = countActiveFilters(filters)
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? ''

  const handleSelect = (bus: SearchBus) => {
    if (!isRoundTrip) {
      router.push(`/booking?busId=${bus._id}&passengers=${passengers}`)
      return
    }
    if (leg === 'outbound') {
      setOutboundPick(bus)
      setFilters(EMPTY_FILTERS)
      setLeg('return')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setReturnPick(bus)
  }

  const startBooking = () => {
    if (!outboundPick || !returnPick) return
    router.push(
      `/booking?busId=${outboundPick._id}&returnBusId=${returnPick._id}&passengers=${passengers}`
    )
  }

  const legHeader =
    leg === 'return' ? { from: to, to: from, date: returnDate } : { from, to, date }

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
            {legHeader.from} → {legHeader.to}
          </span>
          <span className="text-xs text-[#8e9a9d]">
            {formatTripDate(legHeader.date)}
            {isRoundTrip ? ' · Round trip' : ''}
            {passengers > 1 ? ` · ${passengers} Adults` : ''}
          </span>
        </div>
      </div>

      {isRoundTrip && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1">
          {(
            [
              { key: 'outbound' as const, label: 'Going', city: `${from} → ${to}`, day: date, pick: outboundPick },
              { key: 'return' as const, label: 'Return', city: `${to} → ${from}`, day: returnDate, pick: returnPick },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setLeg(tab.key)}
              className={`flex flex-col items-start gap-0.5 rounded-[14px] px-3 py-2.5 text-left transition ${
                leg === tab.key ? 'bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className={`text-[12px] font-bold ${leg === tab.key ? 'text-[#f5a524]' : 'text-[#9ba7aa]'}`}>
                  {tab.label}
                </span>
                {tab.pick && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-3.5 w-3.5">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-[11px] text-[#78868a]">{tab.pick ? `${tab.pick.departureTime} · ৳${tab.pick.price}` : tab.city}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setSheet('sort')} className="chip flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M7 4v16M4 17l3 3 3-3" />
            <path d="M17 20V4M14 7l3-3 3 3" />
          </svg>
          {sortLabel}
        </button>
        <button
          type="button"
          onClick={() => setSheet('filters')}
          className={`chip flex items-center gap-1.5 ${activeFilters > 0 ? 'chip-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M3 5h18l-7 8v6l-4 2v-8z" />
          </svg>
          Filters
          {activeFilters > 0 && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f2661d] px-1 text-[10.5px] font-bold text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {current.loading && <div className="py-16 text-center text-sm text-[#8e9a9d]">Searching buses...</div>}

      {!current.loading && current.error && (
        <div className="py-16 text-center text-sm text-[#f87171]">{current.error}</div>
      )}

      {!current.loading && !current.error && visible.length === 0 && (
        <div className="card mt-5 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-[#8e9a9d]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <rect x="3" y="4" width="18" height="12.5" rx="3" />
              <path d="M3 11h18" />
              <circle cx="7.5" cy="19" r="1.6" />
              <circle cx="16.5" cy="19" r="1.6" />
            </svg>
          </span>
          <h2 className="text-lg font-bold">
            {current.buses.length === 0
              ? 'No buses found'
              : roomy.length === 0
                ? `No bus has ${passengers} seats free`
                : 'Nothing matches those filters'}
          </h2>
          <p className="text-[13px] text-[#9ba7aa]">
            {current.buses.length === 0
              ? 'Try a different date or route.'
              : roomy.length === 0
                ? 'Try another date, or book fewer seats and travel separately.'
                : 'Loosen a filter to see more buses.'}
          </p>
          {activeFilters > 0 && (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="glass-btn glass-btn-plain h-11 text-sm">
              Clear filters
            </button>
          )}
        </div>
      )}

      {!current.loading && visible.length > 0 && (
        <p className="mt-4 text-[12px] text-[#78868a]">
          {visible.length} bus{visible.length === 1 ? '' : 'es'}
          {activeFilters > 0 ? ` of ${roomy.length}` : ''} · {sortLabel.toLowerCase()}
          {tooSmall > 0 ? ` · ${tooSmall} hidden without ${passengers} seats together` : ''}
        </p>
      )}

      <div className={`mt-3 flex flex-col gap-3 ${isRoundTrip && outboundPick && returnPick ? 'pb-28' : ''}`}>
        {visible.map((bus) => (
          <BusCard
            key={bus._id}
            bus={bus}
            cheapest={bus.price === cheapestPrice}
            selected={currentPick?._id === bus._id}
            actionLabel={isRoundTrip ? 'Select' : 'Select seats'}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {!current.loading && visible.length > 0 && !isRoundTrip && (
        <p className="mt-6 text-center text-[11.5px] text-[#78868a]">Prices shown are per seat, all taxes included.</p>
      )}

      {isRoundTrip && outboundPick && returnPick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0e0f]/80 px-5 py-3.5 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="flex grow flex-col gap-0.5">
              <span className="text-[11.5px] text-[#8e9a9d]">Both legs chosen · per seat</span>
              <span className="display text-[19px] font-bold text-[#f5a524]">
                ৳{outboundPick.price + returnPick.price}
              </span>
            </div>
            <button type="button" onClick={startBooking} className="glass-btn h-[46px] px-5 text-sm">
              <span className="icon-disc h-6 w-6">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M5 12h13" />
                  <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
                </svg>
              </span>
              Pick seats
            </button>
          </div>
        </div>
      )}

      {sheet === 'sort' && <SortSheet value={sort} onChange={setSort} onClose={() => setSheet(null)} />}
      {sheet === 'filters' && (
        <FiltersSheet
          filters={filters}
          operators={operators}
          types={types}
          priceRange={priceRange}
          onApply={setFilters}
          onClose={() => setSheet(null)}
        />
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
