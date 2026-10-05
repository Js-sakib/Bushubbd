'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { REVIEW_NAME_MAX, REVIEW_TEXT_MAX, firstName } from '@/lib/reviews'
import { Stars } from '../Reviews'

const LABELS = ['', 'Bad', 'Not good', 'Okay', 'Good', 'Excellent']

/**
 * "Rate your trip" under a paid ticket. The passenger picks stars, may write a few words and
 * chooses the name to show. Their review can be changed later from the same ticket.
 */
export default function ReviewForm({ bookingCode, passengerName }: { bookingCode: string; passengerName: string }) {
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<{ rating: number; text: string; name: string; hidden?: boolean } | null>(null)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [name, setName] = useState(firstName(passengerName))
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch(`/api/reviews?bookingCode=${encodeURIComponent(bookingCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.review) {
          setSaved(d.review)
          setRating(d.review.rating)
          setText(d.review.text)
          setName(d.review.name)
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true))
  }, [bookingCode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) {
      toast.error('Please tap the stars first')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode, rating, text, name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Could not post your review')
        return
      }
      setSaved({ rating, text: text.trim(), name: name.trim(), hidden: saved?.hidden })
      setEditing(false)
      toast.success(saved ? 'Review updated. Thank you!' : 'Thank you! Your review is on our home page.')
    } catch {
      toast.error('No internet connection. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  if (!loaded) return null

  if (saved && !editing) {
    return (
      <div className="no-print card-2 mt-5 flex flex-col gap-2.5 p-4 sm:max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-bold">Your review · আপনার মতামত</span>
          <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-bold text-[#0b7f8c] underline-offset-2 hover:underline">
            Edit
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Stars value={saved.rating} size="h-5 w-5" />
          <span className="text-[12.5px] font-semibold text-[#4a4a4a]">by {saved.name}</span>
        </div>
        {saved.text && <p className="text-[13px] leading-relaxed text-[#2b2b2b]">{saved.text}</p>}
        <span className="text-[11.5px] text-[#555555]">Thank you for helping other passengers choose.</span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="no-print card-2 mt-5 flex flex-col gap-3.5 p-4 sm:max-w-lg">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">How was your BusHub experience?</span>
        <span className="text-[12.5px] text-[#4a4a4a]">আপনার মতামত দিন · Rate us and help other passengers</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              className="rounded-lg p-0.5 transition active:scale-90"
            >
              <svg viewBox="0 0 24 24" className={`h-9 w-9 ${n <= rating ? 'text-[#f5a623]' : 'text-[#d6d6d6]'}`} fill="currentColor" aria-hidden>
                <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
              </svg>
            </button>
          ))}
        </div>
        {rating > 0 && <span className="text-[13px] font-bold text-[#b45309]">{LABELS[rating]}</span>}
      </div>

      <label className="flex flex-col gap-1">
        <span className="label-xs">Your words (optional)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, REVIEW_TEXT_MAX))}
          rows={3}
          placeholder="Easy booking? Good seat? Tell other passengers."
          className="input-dark !h-auto resize-none py-3 leading-relaxed"
        />
        <span className="self-end text-[11px] text-[#666666]">
          {text.length}/{REVIEW_TEXT_MAX}
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="label-xs">Name to show</span>
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, REVIEW_NAME_MAX))} className="input-dark" placeholder="Your first name" />
      </label>

      <div className="flex gap-2.5">
        {saved && (
          <button type="button" onClick={() => setEditing(false)} className="glass-btn glass-btn-plain h-12 px-5 text-sm">
            Cancel
          </button>
        )}
        <button type="submit" disabled={sending} className="glass-btn btn-orange h-12 grow text-sm">
          {sending ? 'Posting...' : saved ? 'Save my review' : 'Post my review'}
        </button>
      </div>
      <span className="text-[11px] leading-snug text-[#555555]">
        Your review shows on our home page with your first name and route. Your phone number and ticket stay private.
      </span>
    </form>
  )
}
