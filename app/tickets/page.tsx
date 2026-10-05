'use client'

import { useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import { forgetTicket, readSavedTickets, type SavedTicket } from '../savedTickets'

type Status = 'upcoming' | 'past' | 'boarded' | 'refunded'

interface FoundTicket {
  bookingCode: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  companyName: string
  busName?: string
  totalPrice?: number
  status: Status
}

const STATUS: Record<Status, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-[#53d3d1]/25 text-[#0a6f6c]' },
  boarded: { label: 'Travelled', className: 'bg-[#111111]/[0.06] text-[#3f3f3f]' },
  past: { label: 'Past trip', className: 'bg-[#111111]/[0.06] text-[#3f3f3f]' },
  refunded: { label: 'Refunded', className: 'bg-[#f87171]/[0.14] text-[#c02626]' },
}

function TicketRow({ ticket, onForget }: { ticket: FoundTicket; onForget?: () => void }) {
  const status = STATUS[ticket.status]
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
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <a href={`/confirmation?bookingId=${encodeURIComponent(ticket.bookingCode)}`} className="glass-btn btn-orange h-11 grow text-[13.5px]">
          {onForget ? 'Open & download' : 'Open & download ticket'}
        </a>
        {onForget && (
          <button type="button" onClick={onForget} className="glass-btn glass-btn-plain h-11 px-4 text-[12.5px]" aria-label={`Remove ${ticket.from} to ${ticket.to} from this phone`}>
            Remove
          </button>
        )}
      </div>
      <span className="text-[11px] text-[#666666]">Ticket {ticket.bookingCode}</span>
    </div>
  )
}

/**
 * My tickets: a passenger who lost their ticket finds it again with the mobile number or email
 * they booked with plus their name, and opens it to download. Tickets this phone has already
 * opened are listed straight away.
 */
export default function MyTickets() {
  const [contact, setContact] = useState('')
  const [name, setName] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<FoundTicket[] | null>(null)
  const [saved, setSaved] = useState<SavedTicket[]>([])

  useEffect(() => setSaved(readSavedTickets()), [])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFound(null)
    setSearching(true)
    try {
      const res = await fetch('/api/tickets/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Could not search right now, please try again')
        return
      }
      setFound(data.tickets)
    } catch {
      setError('No internet connection. Try again in a moment.')
    } finally {
      setSearching(false)
    }
  }

  const today = dhakaDate()
  // A ticket the search just found is not listed a second time.
  const savedRows: FoundTicket[] = saved
    .filter((t) => !found?.some((f) => f.bookingCode === t.bookingCode))
    .map((t) => ({ ...t, status: t.date < today ? 'past' : 'upcoming' }))
  const upcomingFirst = (list: FoundTicket[]) =>
    [...list].sort((a, b) => {
      const order = (t: FoundTicket) => (t.status === 'upcoming' ? 0 : 1)
      if (order(a) !== order(b)) return order(a) - order(b)
      return order(a) === 0 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    })

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

      <form onSubmit={search} className="card-2 mt-5 flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[16px] font-bold">Find your ticket again</span>
          <span className="text-[12.5px] leading-snug text-[#3f3f3f]">
            Forgot to download it? Write the mobile number or email you booked with, and your name. টিকেট হারিয়ে গেলে এখানে খুঁজুন।
          </span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="label-xs">Mobile number or email</span>
          <input
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="01712345678 or you@gmail.com"
            className="input-dark"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-xs">Your name (as on the ticket)</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahima Akter" autoComplete="name" className="input-dark" />
        </label>
        <button type="submit" disabled={searching} className="glass-btn btn-orange h-12 text-sm">
          {searching ? 'Searching...' : 'Find my tickets'}
        </button>
        {error && (
          <p role="alert" className="rounded-2xl bg-[#f87171]/[0.12] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]">
            {error}
          </p>
        )}
        <span className="text-[11px] leading-snug text-[#555555]">
          Tickets show only when both the number (or email) and the name match. Your details stay private.
        </span>
      </form>

      {found && (
        <section className="mt-6 flex flex-col gap-3" aria-live="polite">
          <h2 className="text-[15px] font-bold">
            {found.length} ticket{found.length === 1 ? '' : 's'} found
          </h2>
          {upcomingFirst(found).map((t) => (
            <TicketRow key={t.bookingCode} ticket={t} />
          ))}
        </section>
      )}

      {savedRows.length > 0 && (
        <section className="mt-7 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold">Saved on this phone</h2>
            <span className="text-[12px] text-[#4a4a4a]">Tickets you opened on this phone before.</span>
          </div>
          {upcomingFirst(savedRows).map((t) => (
            <TicketRow
              key={t.bookingCode}
              ticket={t}
              onForget={() => {
                forgetTicket(t.bookingCode)
                setSaved(readSavedTickets())
              }}
            />
          ))}
        </section>
      )}
    </div>
  )
}
