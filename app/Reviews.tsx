'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { REVIEW_SAVED_EVENT, type PublicReview } from '@/lib/reviews'

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

export function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="glass-lite flex gap-3.5 p-4">
      <span className="relative h-12 w-12 shrink-0">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full text-[19px] font-extrabold text-[#1a0d03] ${colourFor(review.name)}`}>
          {review.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#e11d48] ring-2 ring-white">
          <svg viewBox="0 0 24 24" fill="#ffffff" className="h-3 w-3" aria-hidden>
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
          </svg>
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-bold">{review.name}</span>
        <div className="flex flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <Stars value={review.rating} size="h-3.5 w-3.5" />
            <span className="truncate text-[11.5px] font-bold text-[#3f3f3f]">BusHub</span>
          </span>
          {review.companyName && review.companyRating != null && (
            <span className="flex min-w-0 items-center gap-2">
              <Stars value={review.companyRating} size="h-3.5 w-3.5" />
              <span className="truncate text-[11.5px] font-bold text-[#3f3f3f]">{review.companyName}</span>
            </span>
          )}
        </div>
        {review.text && <p className="text-[12.5px] leading-relaxed text-[#2b2b2b]">{review.text}</p>}
        <span className="text-[11.5px] font-semibold text-[#4a4a4a]">
          {review.from} → {review.to}
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
    const load = () =>
      fetch('/api/reviews', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.reviews) return
          setReviews(d.reviews)
          setSummary({ count: d.summary?.bushub?.count || 0, average: d.summary?.bushub?.average || 0 })
        })
        .catch(() => undefined)
    load()
    // A review posted from the "Write a review" pop-up shows straight away.
    window.addEventListener(REVIEW_SAVED_EVENT, load)
    return () => window.removeEventListener(REVIEW_SAVED_EVENT, load)
  }, [])

  if (reviews.length === 0) return null
  const shown = showAll ? reviews : reviews.slice(0, 3)

  return (
    <section className="mt-8 flex flex-col gap-3" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="reviews-title" className="text-[17px] font-bold">
            What passengers say
          </h2>
          <span className="text-[12.5px] font-semibold text-[#3f3f3f]">যাত্রীরা যা বলছেন</span>
        </div>
        <span className="glass-lite inline-flex items-center gap-2 !rounded-full px-3 py-1.5">
          <span className="text-[12.5px] font-bold">BusHub</span>
          <Stars value={Math.round(summary.average)} size="h-3.5 w-3.5" />
          <span className="text-[12.5px] font-bold">
            {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? '' : 's'}
          </span>
        </span>
      </div>

      {shown.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      {reviews.length > 3 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="glass-btn glass-btn-plain h-11 text-[13px]">
          {showAll ? 'Show fewer' : `Show more reviews (${reviews.length - 3})`}
        </button>
      )}
      <Link href="/reviews" className="glass-btn h-12 text-[14px]">
        See all reviews · সব মতামত দেখুন →
      </Link>
    </section>
  )
}
