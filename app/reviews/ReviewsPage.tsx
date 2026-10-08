'use client'

import { useCallback, useEffect, useState } from 'react'
import { REVIEW_SAVED_EVENT, type PublicReview } from '@/lib/reviews'
import { ReviewCard, Stars } from '../Reviews'
import HowToReview from '../HowToReview'

interface Summary {
  bushub: { average: number; count: number; stars: { stars: number; count: number }[] }
  companies: { name: string; average: number; count: number }[]
}

/**
 * Every visible review, newest first: BusHub's own rating and each bus company's rating (no
 * combined score), filters by company and route, 20 at a time, and how to give a review.
 */
export default function ReviewsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [routes, setRoutes] = useState<string[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [company, setCompany] = useState('')
  const [route, setRoute] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(
    async (before: string | null) => {
      setLoading(true)
      setFailed(false)
      const q = new URLSearchParams({ list: '1' })
      if (company) q.set('company', company)
      if (route) q.set('route', route)
      if (before) q.set('before', before)
      try {
        const res = await fetch(`/api/reviews?${q}`, { cache: 'no-store' })
        const d = await res.json()
        if (!res.ok) throw new Error()
        setSummary(d.summary)
        setRoutes(d.routes || [])
        setReviews((list) => (before ? [...list, ...d.reviews] : d.reviews))
        setNext(d.next)
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [company, route]
  )

  useEffect(() => {
    load(null)
    // A review posted from the "Write a review" pop-up shows straight away.
    const reload = () => load(null)
    window.addEventListener(REVIEW_SAVED_EVENT, reload)
    return () => window.removeEventListener(REVIEW_SAVED_EVENT, reload)
  }, [load])

  const b = summary?.bushub
  const maxStar = Math.max(1, ...(b?.stars || []).map((s) => s.count))

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <h1 className="display text-[26px] font-bold leading-tight sm:text-[30px]">Passenger reviews</h1>
      <p className="mt-1 text-[13.5px] text-[#3f3f3f]">যাত্রীদের মতামত · Real reviews from real trips, for BusHub and the bus companies.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* BusHub's own rating */}
        <section className="glass-lite flex flex-col gap-3 p-4" aria-labelledby="bushub-rating">
          <h2 id="bushub-rating" className="text-[15px] font-bold">
            BusHub rating
          </h2>
          <span className="-mt-2 text-[11.5px] text-[#4a4a4a]">Booking, payment, ticket</span>
          <div className="flex items-baseline gap-2">
            <span className="display text-[36px] font-extrabold leading-none">{b && b.count ? b.average.toFixed(1) : '–'}</span>
            <Stars value={Math.round(b?.average || 0)} size="h-5 w-5" />
          </div>
          <span className="text-[12px] text-[#4a4a4a]">
            {b?.count || 0} review{b?.count === 1 ? '' : 's'}
          </span>
          <div className="flex flex-col gap-1.5">
            {(b?.stars || []).map((s) => (
              <div key={s.stars} className="flex items-center gap-2 text-[12px]">
                <span className="w-7 shrink-0 font-bold">{s.stars}★</span>
                <span className="h-2 grow overflow-hidden rounded-full bg-[#111111]/[0.07]">
                  <span className="block h-full rounded-full bg-[#f5a623]" style={{ width: `${(s.count / maxStar) * 100}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums text-[#4a4a4a]">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Each bus company's own rating */}
        <section className="glass-lite flex flex-col gap-3 p-4" aria-labelledby="company-ratings">
          <h2 id="company-ratings" className="text-[15px] font-bold">
            Bus company ratings
          </h2>
          <span className="-mt-2 text-[11.5px] text-[#4a4a4a]">Bus, seat, time, staff · tap one to read its reviews</span>
          {summary && summary.companies.length === 0 && <p className="text-[12.5px] text-[#4a4a4a]">No company reviews yet.</p>}
          <div className="flex flex-col gap-1.5">
            {(summary?.companies || []).map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCompany(company === c.name ? '' : c.name)}
                aria-pressed={company === c.name}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${company === c.name ? 'bg-[#feb249]/30 ring-2 ring-[#f2661d]' : 'bg-white/60 hover:bg-white/80'}`}
              >
                <span className="min-w-0 truncate text-[13px] font-bold">{c.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[13px] font-extrabold">{c.average.toFixed(1)}</span>
                  <Stars value={Math.round(c.average)} size="h-3.5 w-3.5" />
                  <span className="text-[11px] text-[#4a4a4a]">({c.count})</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[150px] grow flex-col gap-1 text-[12px] font-bold sm:grow-0">
          Bus company
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="input-dark !h-11">
            <option value="">All companies</option>
            {(summary?.companies || []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[150px] grow flex-col gap-1 text-[12px] font-bold sm:grow-0">
          Route
          <select value={route} onChange={(e) => setRoute(e.target.value)} className="input-dark !h-11">
            <option value="">All routes</option>
            {routes.map((r) => (
              <option key={r} value={r}>
                {r.replace('→', ' → ')}
              </option>
            ))}
          </select>
        </label>
        {(company || route) && (
          <button
            type="button"
            onClick={() => {
              setCompany('')
              setRoute('')
            }}
            className="h-11 px-2 text-[12.5px] font-bold text-[#0b7f8c]"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-4 flex flex-col gap-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
        {!loading && !failed && reviews.length === 0 && (
          <p className="glass-lite p-5 text-center text-[13px] text-[#3f3f3f]">{company || route ? 'No reviews for this choice yet.' : 'No reviews yet. Be the first!'}</p>
        )}
        {failed && (
          <button type="button" onClick={() => load(null)} className="glass-lite p-5 text-center text-[13px] text-[#b42318]">
            Could not load reviews. Tap to try again.
          </button>
        )}
        {loading && <p className="py-4 text-center text-[13px] text-[#4a4a4a]">Loading reviews…</p>}
        {next && !loading && (
          <button type="button" onClick={() => load(next)} className="glass-btn glass-btn-plain h-12 text-[14px]">
            Load more reviews
          </button>
        )}
      </div>

      <HowToReview />
    </div>
  )
}
