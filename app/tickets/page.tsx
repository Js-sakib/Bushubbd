'use client'

import { useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import { CONTACT_WHATSAPP } from '@/lib/site'
import { forgetTicket, readSavedTickets, type SavedTicket } from '../savedTickets'

function SavedRow({ ticket, past, onForget }: { ticket: SavedTicket; past: boolean; onForget: () => void }) {
  return (
    <div className="card-2 flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="display text-[16px] font-bold leading-tight">
            {ticket.from} → {ticket.to}
          </span>
          <span className="text-[12.5px] font-semibold text-[#3f3f3f]">
            {formatTripDate(ticket.date)} · {ticket.departureTime}
          </span>
          <span className="text-[12px] text-[#4a4a4a]">
            {ticket.companyName}
            {ticket.seats.length > 0 ? ` · Seat${ticket.seats.length === 1 ? '' : 's'} ${ticket.seats.join(', ')}` : ''}
          </span>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${past ? 'bg-[#111111]/[0.06] text-[#3f3f3f]' : 'bg-[#53d3d1]/25 text-[#0a6f6c]'}`}>
          {past ? 'Past trip' : 'Upcoming'}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <a href={`/confirmation?bookingId=${encodeURIComponent(ticket.bookingCode)}`} className="glass-btn btn-orange h-11 grow text-[13.5px]">
          Open &amp; download
        </a>
        <button type="button" onClick={onForget} className="glass-btn glass-btn-plain h-11 px-4 text-[12.5px]" aria-label={`Remove ${ticket.from} to ${ticket.to} from this phone`}>
          Remove
        </button>
      </div>
    </div>
  )
}

/**
 * My tickets: tickets this phone has opened, and "send my ticket again" for a passenger who
 * lost theirs. For privacy a ticket is never shown here from a number or email; it is sent to
 * the WhatsApp number or email it was booked with.
 */
export default function MyTickets() {
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ via: 'whatsapp' | 'email' | 'both'; to: string } | null>(null)
  const [saved, setSaved] = useState<SavedTicket[]>([])

  useEffect(() => setSaved(readSavedTickets()), [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSent(null)
    setSending(true)
    try {
      const res = await fetch('/api/tickets/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Could not send right now, please try again')
        return
      }
      setSent({ via: data.via, to: contact.trim() })
    } catch {
      setError('No internet connection. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const today = dhakaDate()
  const upcomingFirst = [...saved].sort((a, b) => {
    const pa = a.date < today ? 1 : 0
    const pb = b.date < today ? 1 : 0
    if (pa !== pb) return pa - pb
    return pa === 0 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  })
  const whatsappHelp = `https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent('Hi BusHub, I need help getting my ticket.')}`

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-10 pt-5">
      <div className="flex items-center gap-3">
        <a href="/" aria-label="Back to home" className="icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M19 12H6" />
            <path d="m11.5 5.5-6 6.5 6 6.5" />
          </svg>
        </a>
        <div className="flex flex-col leading-tight">
          <h1 className="display text-[20px] font-bold">My tickets</h1>
          <span className="text-[12.5px] font-semibold text-[#3f3f3f]">আমার টিকেট</span>
        </div>
      </div>

      {upcomingFirst.length > 0 && (
        <section className="mt-5 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold">Saved on this phone</h2>
            <span className="text-[12px] text-[#4a4a4a]">Tickets you bought or opened on this phone.</span>
          </div>
          {upcomingFirst.map((t) => (
            <SavedRow
              key={t.bookingCode}
              ticket={t}
              past={t.date < today}
              onForget={() => {
                forgetTicket(t.bookingCode)
                setSaved(readSavedTickets())
              }}
            />
          ))}
        </section>
      )}

      <form onSubmit={send} className="card-2 mt-6 flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[16px] font-bold">Lost your ticket? Get it again</span>
          <span className="text-[12.5px] leading-snug text-[#3f3f3f]">
            Type the mobile number or email you booked with. We send your tickets to that WhatsApp or email. টিকেট হারালে নম্বর দিন, আমরা আপনার WhatsApp বা ইমেইলে পাঠিয়ে দেব।
          </span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="label-xs">Mobile number, email or ticket number</span>
          <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="01712345678" className="input-dark" />
        </label>
        <button type="submit" disabled={sending} className="glass-btn btn-orange h-12 text-sm">
          {sending ? 'Sending...' : 'Send my tickets'}
        </button>

        {error && (
          <p role="alert" className="rounded-2xl bg-[#f87171]/[0.12] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]">
            {error}
          </p>
        )}
        {sent && (
          <div role="status" className="flex gap-3 rounded-2xl border border-[#53d3d1]/70 bg-[#53d3d1]/15 p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#53d3d1] text-[#111111]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="text-[12.5px] leading-snug text-[#1f1f1f]">
              <b>Done.</b>{' '}
              {sent.via === 'email'
                ? `If you booked with ${sent.to}, your tickets are on their way to that inbox. Check Spam too.`
                : sent.via === 'whatsapp'
                  ? `If you booked with ${sent.to}, your tickets are on their way to that number's WhatsApp.`
                  : 'If that ticket number is right, the ticket is on its way to the WhatsApp number and email it was booked with.'}{' '}
              It can take a minute.
            </span>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-2xl bg-white/60 p-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-[#0b7f8c]" aria-hidden>
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="text-[11.5px] leading-snug text-[#3f3f3f]">
            For your safety, tickets never show on this page. They only go to the WhatsApp number or email they were booked with, so nobody else can get your ticket.
          </span>
        </div>
      </form>

      <a
        href={whatsappHelp}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-[#111111]/10 bg-white/75 p-3.5 transition hover:border-[#25D366]/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.3L3.5 20.5 5.1 16A8.4 8.4 0 1 1 20.5 11.6z" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="text-[13.5px] font-bold">Still no ticket? Message us</span>
          <span className="text-[12px] text-[#4a4a4a]">Our team helps you on WhatsApp</span>
        </span>
      </a>
    </div>
  )
}
