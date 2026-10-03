'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { downloadSheet, sumCell, type Sheet } from '@/lib/sheet'
import { dhakaDateTime } from '../company/salesSheet'
import BookingList, { bookingStatus } from './BookingList'
import { taka } from './charts'
import type { Booking } from './types'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'boarded', label: 'Boarded' },
  { key: 'pending', label: 'Pending' },
  { key: 'refunded', label: 'Refunded' },
] as const

const STATUS_WORD = { boarded: 'Boarded', paid: 'Paid', pending: 'Pending', refunded: 'Refunded', expired: 'Expired' } as const
const counts = (b: Booking) => bookingStatus(b) === 'paid' || bookingStatus(b) === 'boarded'

/** The bookings shown, as an Excel sheet: one row per booking with its money. */
function bookingsSheet(list: Booking[]): Sheet {
  const sheet: Sheet = {
    name: 'Bookings',
    header: ['Booking code', 'Passenger', 'Phone', 'Company', 'Bus', 'Number plate', 'From', 'To', 'Travel date', 'Time', 'Seats', 'Seat count', 'Paid', 'BusHub commission', 'Company gets', 'Status', 'Booked on', 'Booked at'],
    rows: list.map((b) => {
      const sold = counts(b)
      return [
        b.bookingCode,
        b.passengerName,
        b.passengerPhone,
        b.companyName,
        b.busName,
        b.plateNumber || '',
        b.from,
        b.to,
        b.date,
        b.departureTime,
        b.seats.join(', '),
        b.seats.length,
        sold ? b.totalPrice : 0,
        sold ? b.commissionAmount || 0 : 0,
        sold ? b.companyPayout ?? b.totalPrice : 0,
        STATUS_WORD[bookingStatus(b)],
        b.source === 'whatsapp' ? 'WhatsApp' : 'Website',
        dhakaDateTime(b.createdAt),
      ]
    }),
  }
  sheet.total = sheet.header.map((_, c) => (c === 0 ? 'Total' : c === 11 || (c >= 12 && c <= 14) ? sumCell(sheet, c) : ''))
  return sheet
}

export default function BookingsSection({
  bookings,
  query,
  onQuery,
  onRefund,
  onDelete,
  onDeleteMany,
}: {
  bookings: Booking[]
  query: string
  onQuery: (q: string) => void
  onRefund: (id: string) => void
  onDelete: (b: Booking) => void
  /** Deletes several bookings; resolves when done so the ticks can be cleared. */
  onDeleteMany: (list: Booking[]) => Promise<void>
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      if (filter !== 'all' && bookingStatus(b) !== filter) return false
      if ((from && b.date < from) || (to && b.date > to)) return false
      if (!q) return true
      return [b.passengerName, b.passengerPhone, b.bookingCode, b.from, b.to, b.busName, b.companyName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    })
  }, [bookings, filter, query, from, to])

  const sold = visible.filter(counts)
  const ticked = visible.filter((b) => selected.has(b._id))
  const select = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  const deleteTicked = async () => {
    setDeleting(true)
    await onDeleteMany(ticked)
    setSelected(new Set())
    setDeleting(false)
  }
  const download = () => {
    if (visible.length === 0) return toast.error('No bookings to put in the sheet')
    downloadSheet(`BusHub bookings${from || to ? ` ${from || 'start'} to ${to || 'now'}` : ''}`, [bookingsSheet(visible)])
  }

  return (
    <section className="glass flex flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[15.5px] font-bold">All bookings</h2>
          <span className="text-[11.5px] text-[#78868a]">
            {visible.length} of {bookings.length}
            {bookings.length >= 200 ? ' latest' : ''}
          </span>
        </div>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e7b7e]">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name, phone, booking code, route"
            aria-label="Search bookings"
            className="input-dark w-full !pl-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label-xs">Travel from</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="input-dark" aria-label="Travel from date" />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label-xs">Travel to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input-dark" aria-label="Travel to date" />
          </label>
          <button type="button" onClick={download} className="glass-btn glass-btn-plain col-span-2 h-12 self-end px-4 text-[12.5px] sm:col-span-1">
            ⬇ Excel sheet
          </button>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`chip shrink-0 ${filter === f.key ? 'chip-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] px-4 py-2.5 text-[12px] text-[#9ba7aa] sm:px-5">
        <span>
          Paid: <b className="text-[#f6f1ea]">{taka(sold.reduce((n, b) => n + b.totalPrice, 0))}</b>
        </span>
        <span>
          Seats: <b className="text-[#f6f1ea]">{sold.reduce((n, b) => n + b.seats.length, 0)}</b>
        </span>
        <span>
          BusHub commission: <b className="text-[#f5a524]">{taka(sold.reduce((n, b) => n + (b.commissionAmount || 0), 0))}</b>
        </span>
        {visible.length > 0 && (
          <button type="button" onClick={() => select(visible.map((b) => b._id), true)} className="ml-auto font-bold text-[#f5a524]">
            Select all shown
          </button>
        )}
      </div>
      {ticked.length > 0 && (
        <div className="sticky top-2 z-20 mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-[#f87171]/30 bg-[#2a1416]/95 px-4 py-2.5 backdrop-blur">
          <span className="grow text-[13px] font-bold">{ticked.length} selected</span>
          <button type="button" onClick={() => setSelected(new Set())} className="h-9 rounded-full border border-white/10 px-3.5 text-[12px] font-bold text-[#c4cdcf]">
            Clear
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={deleteTicked}
            className="h-9 rounded-full bg-[#ef4444] px-4 text-[12px] font-bold text-white disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : `Delete ${ticked.length}`}
          </button>
        </div>
      )}
      <BookingList bookings={visible} onRefund={onRefund} onDelete={onDelete} selected={selected} onSelect={select} empty={query || filter !== 'all' || from || to ? 'No bookings match.' : 'No bookings yet.'} />
    </section>
  )
}
