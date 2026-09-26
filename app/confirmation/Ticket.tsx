'use client'

import { forwardRef } from 'react'
import OperatorLogo from '../OperatorLogo'
import { formatTripDate } from '@/lib/dates'
import Logo from '../BrandLogo'

export interface TicketBooking {
  bookingCode: string
  busName: string
  companyName: string
  logoUrl?: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  passengerName: string
  passengerPhone?: string
  paymentStatus: string
  status: string
  qrCode: string
  validUntil: string
}

function Field({
  label,
  value,
  align = 'left',
  className = '',
}: {
  label: string
  value: string
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : ''} ${className}`}>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#7b8689]">{label}</span>
      <span className="break-words text-[13px] font-bold leading-tight text-[#16191a]">{value}</span>
    </div>
  )
}

/**
 * The printable/downloadable ticket. Rendered on a white card so it stays readable
 * when it is saved as an image and forwarded on WhatsApp.
 */
const Ticket = forwardRef<HTMLDivElement, { booking: TicketBooking }>(function Ticket({ booking }, ref) {
  const refunded = booking.status === 'refunded'

  return (
    <div
      ref={ref}
      // The background is inline rather than a utility class so it survives being cloned
      // into an image; a missing white card would leave every dark label unreadable.
      style={{ backgroundColor: '#ffffff' }}
      className="overflow-hidden rounded-[24px] text-[#16191a] shadow-[0_26px_50px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-3 bg-gradient-to-br from-[#0e3f43] to-[#16585d] px-4 py-4">
        <OperatorLogo
          logoUrl={booking.logoUrl}
          name={booking.companyName}
          variant="light"
          className="h-10 w-10 rounded-[11px]"
        />
        <div className="flex min-w-0 grow flex-col">
          <span className="display text-[15px] font-bold leading-tight text-white">{booking.busName}</span>
          <span className="text-[11.5px] leading-tight text-[#a9c6c8]">{booking.companyName}</span>
        </div>
        <span style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          className="shrink-0 self-start rounded-full px-2.5 py-1 text-[9.5px] font-bold tracking-[0.12em] text-white">
          E-TICKET
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="display text-[26px] font-bold leading-none">{booking.departureTime}</span>
          <span className="text-[12.5px] font-bold">{booking.from}</span>
        </div>
        <div className="flex grow flex-col items-center gap-1.5">
          <div className="flex w-full items-center gap-1">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#0e3f43]" />
            <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_5px,transparent_5px_10px)]" />
            <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <rect x="3" y="4" width="18" height="12.5" rx="3" />
              <path d="M3 11h18" />
            </svg>
            <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_5px,transparent_5px_10px)]" />
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#f2661d]" />
          </div>
          <span className="whitespace-nowrap text-[10.5px] font-semibold text-[#6c7679]">
            {formatTripDate(booking.date)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#7b8689]">Arriving</span>
          <span className="text-[12.5px] font-bold">{booking.to}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-dashed border-[#dfe4e5] px-4 py-3">
        <Field label="Passenger" value={booking.passengerName} className="col-span-2" />
        <Field label="Seats" value={booking.seats.join(', ')} />
        <Field label="Paid" value={`৳${booking.totalPrice}`} align="right" />
      </div>

      <div className="relative h-5" style={{ backgroundColor: '#ffffff' }}>
        <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
        <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
        <span className="absolute left-4 right-4 top-2.5 h-0.5 bg-[repeating-linear-gradient(90deg,#d6dcde_0_6px,transparent_6px_12px)]" />
      </div>

      <div className="flex items-center gap-4 px-4 pb-4 pt-1">
        {booking.qrCode && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={booking.qrCode}
              alt="Ticket QR code"
              style={{ backgroundColor: '#ffffff' }}
              className="h-[104px] w-[104px] rounded-[14px] border border-[#e3e8e9] p-1.5"
            />
            {refunded && (
              <span style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                className="absolute inset-0 flex items-center justify-center rounded-[14px] text-[12px] font-bold uppercase tracking-wider text-[#d14343]">
                Refunded
              </span>
            )}
          </div>
        )}
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#7b8689]">Show this at boarding</span>
          <span className="display text-[15px] font-bold leading-tight tracking-[-0.01em]">{booking.bookingCode}</span>
          <span className="text-[11px] leading-snug text-[#5d6669]">
            The conductor scans this code and it is checked live against BusHub. A screenshot of someone
            else&apos;s ticket will not pass.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#e3e8e9] bg-[#f4f6f6] px-4 py-2.5">
        <Logo tone="light" className="h-5 w-auto" />
        <span className="text-right text-[10px] leading-snug text-[#7b8689]">
          bushubbd.com · info@bushubbd.com
          <br />© {new Date().getFullYear()} BusHub
        </span>
      </div>
    </div>
  )
})

export default Ticket
