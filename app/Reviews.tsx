'use client'

import { useEffect, useState } from 'react'
import type { PublicReview } from '@/lib/reviews'

/** Five stars, the first `value` filled. */
export function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`${size} ${n <= value ? 'text-[#f5a623]' : 'text-[#dcdcdc]'}`} fill="currentColor" aria-hidden>
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
        </svg>
      ))}
    </span>
  )
}

const AVATAR_COLOURS = ['bg-[#53d3d1]', 'bg-[#f9c6dc]', 'bg-[#c9d6ff]', 'bg-[#feb249]']

function colourFor(name: string) {
  let sum = 0
  for (const ch of name) sum += ch.charCodeAt(0)
  return AVATAR_COLOURS[sum % AVATAR_COLOURS.length]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthYear = (iso: string) => {
  const [y, m] = (iso || '').split('-').map(Number)
  return y && m ? `${MONTHS[m - 1]} ${y}` : ''
}

function ReviewCard({ review, tilt }: { review: PublicReview; tilt: boolean }) {
  return (
    <article
      className={`relative flex gap-3.5 rounded-[22px] bg-white p-4 shadow-[0_18px_40px_rgba(140,50,0,0.22)] transition sm:p-5 ${tilt ? 'rotate-[1.6deg]' : ''}`}
    >
      <span className="relative h-14 w-14 shrink-0">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-extrabold text-[#1a0d03] ${colourFor(review.name)}`}>
          {review.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#e11d48] ring-2 ring-white">
          <svg viewBox="0 0 24 24" fill="#ffffff" className="h-3.5 w-3.5" aria-hidden>
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
          </svg>
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[15px] font-bold text-[#111111]">{review.name}</span>
          <Stars value={review.rating} size="h-3.5 w-3.5" />
        </div>
        {review.text && <p className="text-[13px] leading-relaxed text-[#2b2b2b]">{review.text}</p>}
        <span className="text-[11.5px] font-semibold text-[#6a6a6a]">
          {review.from} → {review.to}
          {review.companyName ? ` · ${review.companyName}` : ''}
          {monthYear(review.travelDate) ? ` · ${monthYear(review.travelDate)}` : ''}
        </span>
      </div>
    </article>
  )
}

/**
 * What passengers say, on the home page: an orange panel of review cards. Shows nothing until
 * there is at least one review.
 */
export default function Reviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [summary, setSummary] = useState({ count: 0, average: 0 })
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.reviews) return
        setReviews(d.reviews)
        setSummary(d.summary)
      })
      .catch(() => undefined)
  }, [])

  if (reviews.length === 0) return null
  const shown = showAll ? reviews : reviews.slice(0, 3)

  return (
    <section
      className="relative mt-8 overflow-hidden rounded-[28px] px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-7"
      style={{ background: 'linear-gradient(155deg,#feb249 0%,#f99a3c 40%,#f2661d 100%)' }}
      aria-labelledby="reviews-title"
    >
      {/* A soft swoosh behind the cards, like a road. Decoration only. */}
      <div aria-hidden className="pointer-events-none absolute -left-36 top-28 h-[340px] w-[620px] -rotate-[24deg] rounded-[50%] border-[22px] border-white/20" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <svg viewBox="0 0 48 36" className="h-9 w-12 text-white" fill="currentColor" aria-hidden>
              <path d="M0 36V22C0 9.5 6.5 2 19 0l2 5c-6.5 1.8-9.6 5.8-10 12h9v19zm27 0V22C27 9.5 33.5 2 46 0l2 5c-6.5 1.8-9.6 5.8-10 12h9v19z" />
            </svg>
            <h2 id="reviews-title" className="display text-[22px] font-extrabold leading-tight text-[#1a0d03] sm:text-[26px]">
              What passengers say
            </h2>
            <span className="text-[14px] font-semibold text-[#3a1a05]">যাত্রীরা যা বলছেন</span>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-[0_10px_24px_rgba(140,50,0,0.2)]">
            <Stars value={Math.round(summary.average)} size="h-4 w-4" />
            <span className="text-[13px] font-bold text-[#111111]">
              {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? '' : 's'}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5">
          {shown.map((review, i) => (
            <ReviewCard key={review.id} review={review} tilt={i % 3 === 1} />
          ))}
        </div>

        {reviews.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="mx-auto h-11 rounded-full bg-white px-6 text-[13.5px] font-bold text-[#111111] shadow-[0_10px_24px_rgba(140,50,0,0.2)] transition hover:-translate-y-0.5"
          >
            {showAll ? 'Show fewer' : `Show more reviews (${reviews.length - 3})`}
          </button>
        )}
      </div>
    </section>
  )
}
