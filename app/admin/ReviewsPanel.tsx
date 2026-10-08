'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { downloadSheet, sheetDate } from '@/lib/sheet'
import { Stars } from '../Reviews'

interface AdminReview {
  _id: string
  bookingCode: string
  name: string
  /** BusHub's rating. */
  rating: number
  /** The bus company's rating; older reviews have none, and their one rating counts for both. */
  companyRating?: number
  text: string
  from: string
  to: string
  companyName: string
  travelDate: string
  createdAt: string
  hidden?: boolean
}

interface Subscriber {
  email: string
  createdAt: string
}

const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : ''

/**
 * The admin dashboard's reviews and offer sign-ups: every passenger review, with buttons to hide
 * one from the home page or delete it, and the emails that signed up for offers.
 */
export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/reviews')
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews || [])
        setSubscribers(d.subscribers || [])
      })
      .catch(() => setReviews([]))
  }, [])

  useEffect(load, [load])

  const setHidden = async (review: AdminReview, hidden: boolean) => {
    const res = await fetch(`/api/admin/reviews/${review._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden }),
    })
    if (!res.ok) {
      toast.error('Could not change the review')
      return
    }
    toast.success(hidden ? 'Hidden from the home page' : 'Showing on the home page')
    load()
  }

  const remove = async (review: AdminReview) => {
    if (!confirm(`Delete ${review.name}'s review for good?`)) return
    const res = await fetch(`/api/admin/reviews/${review._id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete the review')
      return
    }
    toast.success('Review deleted')
    load()
  }

  const exportSubscribers = () =>
    downloadSheet(`BusHub-offer-subscribers-${sheetDate(new Date().toISOString().slice(0, 10))}`, [
      {
        name: 'Subscribers',
        title: 'BusHub offer subscribers',
        columns: [{ header: 'Email' }, { header: 'Signed up', kind: 'datetime' }],
        rows: subscribers.map((s) => [s.email, s.createdAt]),
      },
    ])

  if (!reviews) return null
  const visible = reviews.filter((r) => !r.hidden)
  const average = visible.length ? visible.reduce((n, r) => n + r.rating, 0) / visible.length : 0
  const shown = showAll ? reviews : reviews.slice(0, 5)

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="glass flex flex-col gap-3.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="display text-[16px] font-bold">Customer reviews</span>
            <span className="text-[12px] text-[#4a4a4a]">Hide anything that should not be on the home page.</span>
          </div>
          {visible.length > 0 && (
            <span className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
              <span className="text-[12.5px] font-bold">BusHub</span>
              <Stars value={Math.round(average)} size="h-3.5 w-3.5" />
              <span className="text-[12.5px] font-bold">
                {average.toFixed(1)} · {visible.length} showing
              </span>
            </span>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="rounded-2xl bg-white/50 p-4 text-[13px] text-[#4a4a4a]">
            No reviews yet. Passengers can rate their trip on their ticket page after paying.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {shown.map((r) => (
              <div key={r._id} className={`flex flex-col gap-2 rounded-2xl border border-[#111111]/10 bg-white/70 p-3.5 ${r.hidden ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[14px] font-bold">{r.name}</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#3f3f3f]">
                    BusHub <Stars value={r.rating} size="h-3.5 w-3.5" />
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#3f3f3f]">
                    Company <Stars value={r.companyRating ?? r.rating} size="h-3.5 w-3.5" />
                  </span>
                  {r.hidden && <span className="rounded-full bg-[#111111]/[0.07] px-2 py-0.5 text-[10.5px] font-bold text-[#3f3f3f]">Hidden</span>}
                  <span className="ml-auto text-[11.5px] text-[#555555]">{shortDate(r.createdAt)}</span>
                </div>
                {r.text && <p className="text-[13px] leading-relaxed text-[#222222]">{r.text}</p>}
                <span className="text-[11.5px] text-[#4a4a4a]">
                  {r.from} → {r.to} · {r.companyName} · Ticket {r.bookingCode}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHidden(r, !r.hidden)} className="glass-btn glass-btn-plain h-9 px-4 text-[12.5px]">
                    {r.hidden ? 'Show on home page' : 'Hide'}
                  </button>
                  <button type="button" onClick={() => remove(r)} className="glass-btn glass-btn-plain h-9 px-4 text-[12.5px] !text-[#c02626]">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {reviews.length > 5 && (
              <button type="button" onClick={() => setShowAll(!showAll)} className="text-[12.5px] font-bold text-[#0b7f8c]">
                {showAll ? 'Show fewer' : `Show all ${reviews.length} reviews`}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="glass flex h-fit flex-col gap-3 p-4 sm:p-5">
        <span className="display text-[16px] font-bold">Offer subscribers</span>
        <span className="text-[30px] font-extrabold leading-none">{subscribers.length}</span>
        <span className="text-[12px] text-[#4a4a4a]">Emails signed up in the website footer for offers and new routes.</span>
        {subscribers.length > 0 && (
          <>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-2xl bg-white/60 p-3">
              {subscribers.slice(0, 50).map((s) => (
                <span key={s.email} className="truncate text-[12.5px]">
                  {s.email}
                </span>
              ))}
            </div>
            <button type="button" onClick={exportSubscribers} className="glass-btn h-10 text-[13px]">
              Download Excel
            </button>
          </>
        )}
      </div>
    </section>
  )
}
