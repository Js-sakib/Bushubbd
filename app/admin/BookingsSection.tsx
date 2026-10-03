'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { downloadSheet, sheetDate } from '@/lib/sheet'
import { adminBookingSheets, isSale } from './bookingsSheet'
import DateRangePicker from '../DateRangePicker'
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

export default function BookingsSection({
  bookings,
  query,
  onQuery,
  onRefund,
  onDelete,
  onDeleteMany,
  startFilter = 'all',
}: {
  bookings: Booking[]
  query: string
  onQuery: (q: string) => void
  onRefund: (id: string) => void
  onDelete: (b: Booking) => void
  /** Deletes several bookings; resolves when done so the ticks can be cleared. */
  onDeleteMany: (list: Booking[]) => Promise<void>
  /** The status filter the list opens with. */
  startFilter?: (typeof FILTERS)[number]['key']
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>(startFilter)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [by, setBy] = useState<'travel' | 'booked'>('travel')
  /** With dates picked, every booking in them from the server (the plain list has only the latest 200). */
  const [ranged, setRanged] = useState<Booking[] | null>(null)
  const [busyDownload, setBusyDownload] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const rangeUrl = `/api/admin/bookings?from=${from}&to=${to}&by=${by}`
  const fetchRange = async (): Promise<Booking[] | null> => {
    const res = await fetch(rangeUrl, { cache: 'no-store' }).catch(() => null)
    const json = res?.ok ? await res.json().catch(() => null) : null
    return json?.bookings ?? null
  }
  // Re-read when the dates change, and after a refund or delete (the bookings prop is reloaded then).
  useEffect(() => {
    if (!from && !to) return setRanged(null)
    let live = true
    fetchRange().then((list) => live && setRanged(list))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeUrl, bookings])

  const shown = (list: Booking[]) => {
    const q = query.trim().toLowerCase()
    return list.filter((b) => {
      if (filter !== 'all' && bookingStatus(b) !== filter) return false
      if (!q) return true
      return [b.passengerName, b.passengerPhone, b.passengerEmail, b.bookingCode, b.from, b.to, b.busName, b.companyName, b.plateNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    })
  }
  const source = ranged ?? bookings
  const visible = shown(source)

  const sold = visible.filter(isSale)
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
  // The sheet always comes from the server, so it has every booking in the dates, not just the latest 200.
  const download = async () => {
    setBusyDownload(true)
    const all = await fetchRange()
    setBusyDownload(false)
    if (!all) return toast.error('Could not load the bookings. Try again.')
    const list = shown(all)
    if (list.length === 0) return toast.error('No bookings to put in the sheet')
    const notes = [
      from || to ? `Date range (${by === 'booked' ? 'day bought' : 'travel date'}): ${from ? sheetDate(from) : 'start'} to ${to ? sheetDate(to) : 'today'}` : 'Date range: all bookings',
      filter !== 'all' ? `Status: ${FILTERS.find((f) => f.key === filter)?.label}` : '',
      query.trim() ? `Search: ${query.trim()}` : '',
    ].filter(Boolean)
    downloadSheet(`BusHub bookings ${from || 'start'} to ${to || 'now'}`, adminBookingSheets(list, notes))
  }

  return (
    <section className="glass flex flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[15.5px] font-bold">All bookings</h2>
          <span className="text-[11.5px] text-[#555555]">
            {visible.length} of {source.length}
            {!ranged && bookings.length >= 200 ? ' latest' : ''}
          </span>
        </div>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e5e5e]">
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="label-xs">Dates are</span>
            <div className="flex h-12 gap-1 rounded-[14px] border border-[#111111]/10 bg-white/60 p-1">
              {(['travel', 'booked'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBy(k)}
                  className={`grow rounded-[10px] px-3 text-[12px] font-bold ${by === k ? 'bg-[#111111] text-[#ffffff]' : 'text-[#3f3f3f]'}`}
                >
                  {k === 'travel' ? 'Travel date' : 'Day bought'}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <DateRangePicker
              label={by === 'travel' ? 'Travel dates' : 'Days bought'}
              from={from}
              to={to}
              onChange={(f, t) => {
                setFrom(f)
                setTo(t)
              }}
            />
          </div>
          <button
            type="button"
            onClick={download}
            disabled={busyDownload}
            className="glass-btn glass-btn-plain col-span-2 h-12 self-end px-4 text-[12.5px] disabled:opacity-60 sm:col-span-1"
          >
            {busyDownload ? 'Making the sheet…' : '⬇ Excel sheet'}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#111111]/10 px-4 py-2.5 text-[12px] text-[#3f3f3f] sm:px-5">
        <span>
          Paid: <b className="text-[#1b1b1b]">{taka(sold.reduce((n, b) => n + b.totalPrice, 0))}</b>
        </span>
        <span>
          Seats: <b className="text-[#1b1b1b]">{sold.reduce((n, b) => n + b.seats.length, 0)}</b>
        </span>
        <span>
          BusHub commission: <b className="text-[#0b7f8c]">{taka(sold.reduce((n, b) => n + (b.commissionAmount || 0), 0))}</b>
        </span>
        {visible.length > 0 && (
          <button type="button" onClick={() => select(visible.map((b) => b._id), true)} className="ml-auto font-bold text-[#0b7f8c]">
            Select all shown
          </button>
        )}
      </div>
      {ticked.length > 0 && (
        <div className="sticky top-2 z-20 mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-[#f87171]/30 bg-[#fdeaea]/95 px-4 py-2.5 backdrop-blur">
          <span className="grow text-[13px] font-bold">{ticked.length} selected</span>
          <button type="button" onClick={() => setSelected(new Set())} className="h-9 rounded-full border border-[#111111]/10 px-3.5 text-[12px] font-bold text-[#222222]">
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
