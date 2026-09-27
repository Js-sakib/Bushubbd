'use client'

import { forwardRef } from 'react'
import OperatorLogo from '../OperatorLogo'
import { formatTripDate } from '@/lib/dates'
import Logo from '../BrandLogo'
import { CONTACT_PHONE } from '@/lib/site'

export interface TicketBooking {
  bookingCode: string
  busName: string
  companyName: string
  logoUrl?: string
  from: string
  to: string
  date: string
  departureTime: string
  /** Trip details copied at booking time; tickets from before they were stored have none. */
  arrivalTime?: string
  busType?: string
  pricePerSeat?: number
  bags?: number
  seats: string[]
  totalPrice: number
  passengerName: string
  passengerPhone?: string
  paymentMethod?: string
  paymentStatus: string
  status: string
  qrCode: string
  validUntil: string
}

const INK = '#16191a'
const MUTED = '#7b8689'
const PAYMENT_NAMES: Record<string, string> = { bkash: 'bKash', nagad: 'Nagad', card: 'Card' }

/** "Cox's Bazar" → "COX", like an airport code, for the big route line. */
function cityCode(city: string): string {
  return city.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || city.slice(0, 3)
}

function toMinutes(hhmm?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function clock(total: number): string {
  const m = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Journey length, allowing for trips that arrive after midnight. */
function duration(dep?: string, arr?: string): string {
  const a = toMinutes(dep)
  const b = toMinutes(arr)
  if (a === null || b === null) return ''
  const mins = (b - a + 1440) % 1440
  if (!mins) return ''
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`
}

/** Only the start and end of the number, so a forwarded ticket doesn't give the full number away. */
function maskPhone(phone?: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 7) return phone || '—'
  const local = d.startsWith('880') ? `0${d.slice(3)}` : d
  return `${local.slice(0, 3)}•••••${local.slice(-3)}`
}

function Field({ label, value, className = '', align = 'left' }: { label: string; value: string; className?: string; align?: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : ''} ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="break-words text-[13px] font-bold leading-tight" style={{ color: INK }}>
        {value}
      </span>
    </div>
  )
}

/** Faint "bushubbd.com" repeated across the ticket, so a copied or edited ticket still says where it came from. */
function Watermark() {
  const rows = Array.from({ length: 14 })
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute flex flex-col gap-7"
        style={{ left: '-40%', top: '-10%', width: '180%', transform: 'rotate(-24deg)', transformOrigin: 'center' }}
      >
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-[13px] font-extrabold tracking-[0.18em]"
            style={{ color: '#0e3f43', opacity: 0.055, paddingLeft: i % 2 ? 60 : 0 }}
          >
            {'BUSHUBBD.COM  ·  BUSHUB  ·  '.repeat(6)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The boarding pass: printed, saved as an image and forwarded on WhatsApp. White card with
 * inline colours so it looks the same in every one of those, and a notched tear line above the
 * QR stub like an airline pass.
 */
const Ticket = forwardRef<HTMLDivElement, { booking: TicketBooking }>(function Ticket({ booking }, ref) {
  const refunded = booking.status === 'refunded'
  const paid = booking.paymentStatus === 'paid' && !refunded
  const seatCount = booking.seats.length
  const perSeat = booking.pricePerSeat ?? (seatCount ? Math.round(booking.totalPrice / seatCount) : booking.totalPrice)
  const dep = toMinutes(booking.departureTime)
  const reportBy = dep === null ? '—' : clock(dep - 15)
  const trip = duration(booking.departureTime, booking.arrivalTime)
  const method = booking.paymentMethod ? PAYMENT_NAMES[booking.paymentMethod] || booking.paymentMethod : ''
  const bagsText =
    typeof booking.bags !== 'number' ? 'Not declared' : booking.bags === 0 ? 'No bags' : `${booking.bags} bag${booking.bags === 1 ? '' : 's'}`
  const statusStyle = refunded
    ? { background: '#fde8e8', color: '#c53030' }
    : paid
      ? { background: '#e3f6ee', color: '#1f7a55' }
      : { background: '#fff4e0', color: '#b7791f' }
  const statusText = refunded ? 'Refunded' : paid ? 'Paid' : 'Pending'
  const year = new Date().getFullYear()

  return (
    <div
      ref={ref}
      // Inline background so it survives being cloned into an image.
      style={{ backgroundColor: '#ffffff', color: INK }}
      className="ticket-print relative overflow-hidden rounded-[24px] shadow-[0_26px_50px_rgba(0,0,0,0.5)]"
    >
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#0e3f43] to-[#16585d] px-5 pb-4 pt-4" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-between gap-3">
          <Logo tone="dark" className="h-6 w-auto" />
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] font-extrabold tracking-[0.2em] text-white">BOARDING PASS</span>
            <span className="mt-1 text-[10px] font-semibold text-[#a9c6c8]">বোর্ডিং পাস · E-ticket</span>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <OperatorLogo logoUrl={booking.logoUrl} name={booking.companyName} variant="light" className="h-9 w-9 rounded-[10px]" />
          <div className="flex min-w-0 grow flex-col">
            <span className="display truncate text-[14px] font-bold leading-tight text-white">{booking.busName}</span>
            <span className="truncate text-[11px] leading-tight text-[#a9c6c8]">{booking.companyName}</span>
          </div>
          {booking.busType && (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              {booking.busType}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <Watermark />

        {/* Route */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 pb-3 pt-4" style={{ zIndex: 1 }}>
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>From</span>
            <span className="display text-[34px] font-bold leading-none tracking-[-0.02em]">{cityCode(booking.from)}</span>
            <span className="mt-1 truncate text-[12px] font-bold">{booking.from}</span>
          </div>
          <div className="flex w-[92px] flex-col items-center gap-1">
            <div className="flex w-full items-center gap-1">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#0e3f43]" />
              <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_4px,transparent_4px_8px)]" />
              <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
                <rect x="3" y="4" width="18" height="12.5" rx="3" />
                <path d="M3 11h18" />
                <circle cx="7.5" cy="19" r="1.6" />
                <circle cx="16.5" cy="19" r="1.6" />
              </svg>
              <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_4px,transparent_4px_8px)]" />
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#f2661d]" />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: MUTED }}>{trip || 'Bus'}</span>
          </div>
          <div className="flex min-w-0 flex-col items-end text-right">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>To</span>
            <span className="display text-[34px] font-bold leading-none tracking-[-0.02em]">{cityCode(booking.to)}</span>
            <span className="mt-1 truncate text-[12px] font-bold">{booking.to}</span>
          </div>
        </div>

        {/* Journey details */}
        <div className="relative grid grid-cols-3 gap-x-3 gap-y-3 border-t border-dashed border-[#dfe4e5] px-5 py-3.5" style={{ zIndex: 1 }}>
          <Field label="Passenger" value={booking.passengerName} className="col-span-2" />
          <Field label="Phone" value={maskPhone(booking.passengerPhone)} align="right" />
          <Field label="Date" value={formatTripDate(booking.date)} />
          <Field label="Departs" value={booking.departureTime || '—'} />
          <Field label="Arrives" value={booking.arrivalTime || '—'} align="right" />
          <Field label="Seats" value={booking.seats.join(', ')} className="col-span-2" />
          <Field label="No. of seats" value={String(seatCount)} align="right" />
          <Field label="Report by" value={reportBy} />
          <Field label="Ticket no." value={booking.bookingCode} className="col-span-2" align="right" />
        </div>

        {/* Fare */}
        <div className="relative mx-5 rounded-2xl border border-[#e3e8e9] px-3.5 py-3" style={{ zIndex: 1, backgroundColor: 'rgba(244,246,246,0.92)' }}>
          <div className="flex items-center justify-between text-[12px]">
            <span style={{ color: MUTED }}>Fare</span>
            <span className="font-semibold">
              ৳{perSeat.toLocaleString('en-US')} × {seatCount} seat{seatCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span style={{ color: MUTED }}>Payment</span>
            <span className="flex items-center gap-2 font-semibold">
              {method}
              <span className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em]" style={statusStyle}>
                {statusText}
              </span>
            </span>
          </div>
          <div className="mt-2.5 flex items-end justify-between border-t border-[#dfe4e5] pt-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em]">Total paid</span>
            <span className="display text-[24px] font-bold leading-none">৳{booking.totalPrice.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Additional: luggage */}
        <div
          className="relative mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-dashed px-3.5 py-2.5"
          style={{ zIndex: 1, borderColor: 'rgba(242,102,29,0.45)', backgroundColor: 'rgba(255,244,236,0.92)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 shrink-0">
            <rect x="4" y="7" width="16" height="13" rx="2.5" />
            <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M9 11v5M15 11v5" />
          </svg>
          <div className="flex min-w-0 grow flex-col">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: '#b8480f' }}>
              Additional · অতিরিক্ত
            </span>
            <span className="text-[13px] font-bold leading-tight">Luggage: {bagsText}</span>
          </div>
        </div>

        {/* Tear line */}
        <div className="relative mt-4 h-5" style={{ zIndex: 1 }}>
          <span className="ticket-notch absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
          <span className="ticket-notch absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
          <span className="absolute left-4 right-4 top-2.5 h-0.5 bg-[repeating-linear-gradient(90deg,#d6dcde_0_6px,transparent_6px_12px)]" />
        </div>

        {/* Boarding stub */}
        <div className="relative flex flex-col items-center gap-2 px-5 pb-4 pt-1 text-center" style={{ zIndex: 1 }}>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
            Show this at boarding
          </span>
          {booking.qrCode && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.qrCode}
                alt="Ticket QR code"
                style={{ backgroundColor: '#ffffff' }}
                className="h-[150px] w-[150px] rounded-[16px] border border-[#e3e8e9] p-2"
              />
              {refunded && (
                <span
                  style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                  className="absolute inset-0 flex items-center justify-center rounded-[16px] text-[14px] font-extrabold uppercase tracking-wider text-[#d14343]"
                >
                  Refunded
                </span>
              )}
            </div>
          )}
          <span className="display text-[17px] font-bold tracking-[0.02em]">{booking.bookingCode}</span>
          <span className="max-w-[290px] text-[10.5px] leading-snug" style={{ color: '#5d6669' }}>
            The conductor scans this code and it is checked live on BusHub. A copy or screenshot of someone else&apos;s
            ticket will not pass. Please be at the counter by {reportBy}.
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between gap-2 border-t border-[#e3e8e9] bg-[#f4f6f6] px-5 py-2.5" style={{ zIndex: 1 }}>
        <Logo tone="light" className="h-5 w-auto" />
        <span className="text-right text-[9.5px] leading-snug" style={{ color: MUTED }}>
          © {year} BusHub · bushubbd.com · All rights reserved
          <br />
          Help: {CONTACT_PHONE}
        </span>
      </div>

      {refunded && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
          <span
            className="rounded-xl border-4 px-5 py-1 text-[34px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(209,67,67,0.55)', borderColor: 'rgba(209,67,67,0.55)', transform: 'rotate(-18deg)' }}
          >
            Refunded
          </span>
        </div>
      )}
    </div>
  )
})

export default Ticket
