'use client'

import { formatTripDate } from '@/lib/dates'
import { taka } from './charts'
import type { Booking } from './types'

type StatusKey = 'boarded' | 'paid' | 'pending' | 'refunded' | 'expired'

export function bookingStatus(b: Booking): StatusKey {
  if (b.status === 'refunded') return 'refunded'
  if (b.paymentStatus === 'paid' && b.status === 'confirmed') return b.checkedIn ? 'boarded' : 'paid'
  if (b.status === 'pending') return 'pending'
  return 'expired'
}

// A status always shows its word next to the colour, never the colour alone.
const STATUS: Record<StatusKey, { label: string; className: string; dot: string }> = {
  boarded: { label: 'Boarded', className: 'bg-[#12a594]/[0.16] text-[#5eead4]', dot: 'bg-[#2dd4bf]' },
  paid: { label: 'Paid', className: 'bg-[#34d399]/[0.13] text-[#6ee7b7]', dot: 'bg-[#34d399]' },
  pending: { label: 'Pending', className: 'bg-[#f5a524]/[0.14] text-[#fbbf24]', dot: 'bg-[#f5a524]' },
  refunded: { label: 'Refunded', className: 'bg-[#f87171]/[0.13] text-[#fca5a5]', dot: 'bg-[#f87171]' },
  expired: { label: 'Expired', className: 'bg-white/[0.06] text-[#9ba7aa]', dot: 'bg-[#6e7b7e]' },
}

export function StatusChip({ status }: { status: StatusKey }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[12px] font-bold text-[#1a0d03] shadow-[0_4px_14px_rgba(242,102,29,0.3)]">
      {initials(name)}
    </span>
  )
}

function Channel({ source }: { source?: string }) {
  return source === 'whatsapp' ? (
    <span className="text-[12px] font-semibold text-[#86efac]">WhatsApp</span>
  ) : (
    <span className="text-[12px] font-semibold text-[#93c5fd]">Website</span>
  )
}

function RefundButton({ booking, onRefund }: { booking: Booking; onRefund: (id: string) => void }) {
  if (bookingStatus(booking) !== 'paid') return null
  return (
    <button
      type="button"
      onClick={() => onRefund(booking._id)}
      className="h-8 shrink-0 rounded-full border border-[#f87171]/30 bg-[#f87171]/10 px-3 text-[11.5px] font-bold text-[#fca5a5] transition hover:bg-[#f87171]/20"
    >
      Refund
    </button>
  )
}

export default function BookingList({
  bookings,
  onRefund,
  empty = 'No bookings yet.',
}: {
  bookings: Booking[]
  onRefund: (id: string) => void
  empty?: string
}) {
  if (bookings.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-[#8e9a9d]">{empty}</p>
  }

  return (
    <>
      {/* Phone: one card per booking. */}
      <ul className="flex flex-col md:hidden">
        {bookings.map((b) => (
          <li key={b._id} className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 first:border-t-0">
            <Avatar name={b.passengerName} />
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-semibold">{b.passengerName}</span>
              <span className="truncate text-[11.5px] text-[#8e9a9d]">
                {b.from} → {b.to} · {formatTripDate(b.date)}
              </span>
              <span className="truncate text-[11px] text-[#6e7b7e]">
                {b.busName} · seats {b.seats.join(', ')}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[13.5px] font-bold">{taka(b.totalPrice)}</span>
              <StatusChip status={bookingStatus(b)} />
              <RefundButton booking={b} onRefund={onRefund} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: a table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e7b7e]">
              <th className="px-5 py-3 font-bold">Passenger</th>
              <th className="px-3 py-3 font-bold">Route</th>
              <th className="px-3 py-3 font-bold">Travel</th>
              <th className="px-3 py-3 font-bold">Seats</th>
              <th className="px-3 py-3 text-right font-bold">Paid</th>
              <th className="px-3 py-3 font-bold">Booked on</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-5 py-3 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id} className="border-t border-white/[0.06] transition hover:bg-white/[0.025]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={b.passengerName} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[13.5px] font-semibold">{b.passengerName}</span>
                      <span className="text-[11.5px] text-[#6e7b7e]">{b.passengerPhone}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="block whitespace-nowrap text-[13px] font-semibold">
                    {b.from} → {b.to}
                  </span>
                  <span className="text-[11.5px] text-[#6e7b7e]">{b.busName}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[#b7c1c3]">
                  {formatTripDate(b.date)}
                  <span className="block text-[11.5px] text-[#6e7b7e]">{b.departureTime}</span>
                </td>
                <td className="px-3 py-3 text-[12.5px] tabular-nums text-[#b7c1c3]">{b.seats.join(', ')}</td>
                <td className="px-3 py-3 text-right text-[13px] font-bold tabular-nums">{taka(b.totalPrice)}</td>
                <td className="px-3 py-3">
                  <Channel source={b.source} />
                </td>
                <td className="px-3 py-3">
                  <StatusChip status={bookingStatus(b)} />
                </td>
                <td className="px-5 py-3 text-right">
                  <RefundButton booking={b} onRefund={onRefund} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
