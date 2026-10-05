'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { whatsappNumber } from '@/lib/phone'

export interface TicketMatch {
  _id: string
  bookingCode: string
  passengerName: string
  passengerPhone?: string
  passengerEmail?: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  companyName: string
  status: string
  checkedIn?: boolean
  nameMatch: boolean
}

export interface TicketRequest {
  _id: string
  contact: string
  name: string
  note?: string
  status: 'new' | 'sent' | 'rejected'
  createdAt: string
  sentBookingCode?: string
  matches: TicketMatch[]
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

const STATUS = {
  new: { label: 'New', className: 'bg-[#f2661d] text-white' },
  sent: { label: 'Sent', className: 'bg-[#53d3d1] text-[#111111]' },
  rejected: { label: 'Rejected', className: 'bg-[#111111]/[0.08] text-[#3f3f3f]' },
}

function message(t: TicketMatch) {
  const link = `${window.location.origin}/confirmation?bookingId=${encodeURIComponent(t.bookingCode)}`
  return `Hello ${t.passengerName}, this is BusHub. Here is your ticket:\n${t.from} → ${t.to}\n${t.date} ${t.departureTime} · Seat ${t.seats.join(', ')}\nTicket ${t.bookingCode}\n\nOpen & download: ${link}\n\nআপনার টিকেট উপরের লিংক থেকে ডাউনলোড করুন। QR কোড কারও সাথে শেয়ার করবেন না।`
}

function MatchRow({ match, onSent }: { match: TicketMatch; onSent: (via: string) => void }) {
  const wa = match.passengerPhone ? whatsappNumber(match.passengerPhone) : null
  const used = match.checkedIn || match.status === 'refunded'
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[#111111]/10 bg-white/80 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[14px] font-bold">
            {match.from} → {match.to}
          </span>
          <span className="text-[12px] text-[#3f3f3f]">
            {formatTripDate(match.date)} · {match.departureTime} · Seat {match.seats.join(', ')} · {match.companyName}
          </span>
        </div>
        {used && (
          <span className="rounded-full bg-[#f87171]/15 px-2 py-0.5 text-[11px] font-bold text-[#b91c1c]">{match.status === 'refunded' ? 'Refunded' : 'Already boarded'}</span>
        )}
      </div>
      <div className="grid gap-1 text-[12.5px] sm:grid-cols-3">
        <span>
          <span className="text-[#5e5e5e]">Name on ticket: </span>
          <b>{match.passengerName}</b>{' '}
          {match.nameMatch ? (
            <span className="font-bold text-[#0a7a74]">✓ matches</span>
          ) : (
            <span className="font-bold text-[#c2410c]">⚠ different name</span>
          )}
        </span>
        <span>
          <span className="text-[#5e5e5e]">Phone: </span>
          <b>{match.passengerPhone || '—'}</b>
        </span>
        <span className="truncate">
          <span className="text-[#5e5e5e]">Email: </span>
          <b>{match.passengerEmail || '—'}</b>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(message(match))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSent('whatsapp')}
            className="flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(37,211,102,0.3)]"
          >
            Send on WhatsApp
          </a>
        )}
        {match.passengerEmail && (
          <a
            href={`mailto:${match.passengerEmail}?subject=${encodeURIComponent(`Your BusHub ticket ${match.bookingCode}`)}&body=${encodeURIComponent(message(match))}`}
            onClick={() => onSent('email')}
            className="flex h-10 items-center rounded-full bg-[#53d3d1] px-4 text-[13px] font-bold text-[#111111]"
          >
            Send by email
          </a>
        )}
        <a href={`/confirmation?bookingId=${encodeURIComponent(match.bookingCode)}`} target="_blank" rel="noopener noreferrer" className="glass-btn glass-btn-plain h-10 px-4 text-[13px]">
          Open ticket
        </a>
      </div>
    </div>
  )
}

/**
 * Lost-ticket requests on the admin dashboard. Each shows what the passenger typed and the
 * tickets it matches, checked again now; the admin sends the ticket to the WhatsApp number or
 * email it was booked with, or rejects the request.
 */
export default function TicketRequestsPanel({ requests, onChanged }: { requests: TicketRequest[]; onChanged: () => void }) {
  const [showHandled, setShowHandled] = useState(false)
  if (requests.length === 0) return null
  const fresh = requests.filter((r) => r.status === 'new')
  const handled = requests.filter((r) => r.status !== 'new')

  const setStatus = async (r: TicketRequest, status: TicketRequest['status'], extra: Record<string, string> = {}) => {
    const res = await fetch(`/api/admin/ticket-requests/${r._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    })
    if (!res.ok) {
      toast.error('Could not update the request')
      return
    }
    if (status === 'sent') toast.success('Marked as sent')
    if (status === 'rejected') toast.success('Request rejected')
    onChanged()
  }

  const card = (r: TicketRequest) => (
    <div key={r._id} className={`flex flex-col gap-3 rounded-[20px] border bg-white/60 p-4 ${r.status === 'new' ? 'border-[#f2661d]/50' : 'border-[#111111]/10 opacity-75'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold">{r.name}</span>
          <span className="text-[12.5px] text-[#3f3f3f]">
            Asked with <b>{r.contact}</b> · {ago(r.createdAt)}
          </span>
          {r.note && <span className="text-[12.5px] italic text-[#3f3f3f]">&ldquo;{r.note}&rdquo;</span>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[r.status].className}`}>
          {STATUS[r.status].label}
          {r.status === 'sent' && r.sentBookingCode ? ` · ${r.sentBookingCode}` : ''}
        </span>
      </div>

      {r.matches.length === 0 ? (
        <p className="rounded-2xl bg-[#f87171]/[0.12] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]">
          No paid ticket found for this number, email or ticket number. Do not send anything; ask the customer on WhatsApp if needed.
        </p>
      ) : (
        <>
          <span className="text-[12px] font-bold text-[#2b2b2b]">
            {r.matches.length} matching ticket{r.matches.length === 1 ? '' : 's'}. Check the name, then send to the number or email the ticket was booked with:
          </span>
          {r.matches.map((m) => (
            <MatchRow key={m._id} match={m} onSent={(via) => setStatus(r, 'sent', { bookingCode: m.bookingCode, via })} />
          ))}
        </>
      )}

      <div className="flex gap-2">
        {r.status === 'new' ? (
          <button type="button" onClick={() => setStatus(r, 'rejected')} className="glass-btn glass-btn-plain h-9 px-4 text-[12.5px]">
            Reject
          </button>
        ) : (
          <button type="button" onClick={() => setStatus(r, 'new')} className="glass-btn glass-btn-plain h-9 px-4 text-[12.5px]">
            Move back to new
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section className="glass mb-5 flex flex-col gap-3.5 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#feb249] to-[#f2661d] text-[#1a0d03]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {fresh.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[11px] font-bold text-white">{fresh.length}</span>
          )}
        </span>
        <div className="flex flex-col">
          <span className="display text-[16px] font-bold">Lost ticket requests</span>
          <span className="text-[12px] text-[#4a4a4a]">
            {fresh.length ? `${fresh.length} waiting for you` : 'Nothing waiting'} · Send only to the number or email on the ticket.
          </span>
        </div>
      </div>
      {fresh.map(card)}
      {handled.length > 0 && (
        <>
          <button type="button" onClick={() => setShowHandled(!showHandled)} className="self-start text-[12.5px] font-bold text-[#0b7f8c]">
            {showHandled ? 'Hide handled requests' : `Show handled requests (${handled.length})`}
          </button>
          {showHandled && handled.map(card)}
        </>
      )}
    </section>
  )
}
