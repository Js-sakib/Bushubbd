'use client'

import { forwardRef } from 'react'
import OperatorLogo from '../OperatorLogo'
import Logo from '../BrandLogo'
import { CONTACT_PHONE } from '@/lib/site'
import { bnClock, bnDate, bnDigits, bnDuration } from '@/lib/bangla'
import { banglaCity } from '@/lib/routes'

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
  boardingPoint?: string
  boardingMapUrl?: string
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
  passengerEmail?: string
  /** When the ticket was sent to the passenger's email / WhatsApp after payment. */
  ticketEmailedAt?: string
  ticketWhatsappedAt?: string
}

const INK = '#100c0d'
const REPORT_MINUTES = 30
const MUTED = '#8a8f86'
const PAYMENT_NAMES: Record<string, string> = { bkash: 'বিকাশ', nagad: 'নগদ', card: 'কার্ড' }
const BUS_TYPES: Record<string, string> = { AC: 'এসি', 'Non-AC': 'নন-এসি', Sleeper: 'স্লিপার' }
const BANGLA_FONT = 'var(--font-bangla), var(--font-body), sans-serif'

function toMinutes(hhmm?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Journey length in minutes, allowing for trips that arrive after midnight. */
function tripMinutes(dep?: string, arr?: string): number {
  const a = toMinutes(dep)
  const b = toMinutes(arr)
  return a === null || b === null ? 0 : (b - a + 1440) % 1440
}

/** A city in Bangla where we know its name, otherwise as the admin typed it. */
function city(name: string): string {
  return banglaCity(name) || name
}

/** Only the start and end of the number, so a forwarded ticket doesn't give the full number away. */
function maskPhone(phone?: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 7) return phone || '—'
  const local = d.startsWith('880') ? `0${d.slice(3)}` : d
  return bnDigits(`${local.slice(0, 3)}•••••${local.slice(-3)}`)
}

function Field({ label, value, className = '', align = 'left', nowrap = false }: { label: string; value: string; className?: string; align?: 'left' | 'right'; nowrap?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : ''} ${className}`}>
      <span className="text-[10.5px] font-semibold leading-tight" style={{ color: MUTED }}>
        {label}
      </span>
      <span className={`${nowrap ? 'whitespace-nowrap text-[12.5px]' : 'break-words text-[13.5px]'} font-bold leading-snug`} style={{ color: INK }}>
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
        className="absolute flex flex-col gap-10"
        style={{ left: '-40%', top: '-10%', width: '180%', transform: 'rotate(-24deg)', transformOrigin: 'center' }}
      >
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-[13px] font-extrabold tracking-[0.18em]"
            style={{ color: '#002447', opacity: 0.035, paddingLeft: i % 2 ? 60 : 0 }}
          >
            {'BUSHUBBD.COM  ·  BUSHUB  ·  '.repeat(6)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The bus ticket: printed, saved as an image and forwarded on WhatsApp. Written in Bangla,
 * on a white card with inline colours so it looks the same in all three, with a notched
 * tear line above the QR stub.
 */
const Ticket = forwardRef<HTMLDivElement, { booking: TicketBooking }>(function Ticket({ booking }, ref) {
  const refunded = booking.status === 'refunded'
  const paid = booking.paymentStatus === 'paid' && !refunded
  const seatCount = booking.seats.length
  const perSeat = booking.pricePerSeat ?? (seatCount ? Math.round(booking.totalPrice / seatCount) : booking.totalPrice)
  const dep = toMinutes(booking.departureTime)
  const arr = toMinutes(booking.arrivalTime)
  // Passengers are asked to be at the counter half an hour before the bus leaves.
  const reportBy = dep === null ? '—' : bnClock(dep - REPORT_MINUTES)
  const trip = tripMinutes(booking.departureTime, booking.arrivalTime)
  const method = booking.paymentMethod ? PAYMENT_NAMES[booking.paymentMethod] || booking.paymentMethod : ''
  const busType = booking.busType ? BUS_TYPES[booking.busType] || booking.busType : ''
  const bagsText =
    typeof booking.bags !== 'number'
      ? 'উল্লেখ করা হয়নি'
      : booking.bags === 0
        ? 'কোনো ব্যাগ নেই'
        : `${bnDigits(booking.bags)}টি ব্যাগ`
  const statusStyle = refunded
    ? { background: '#fde8e8', color: '#c53030' }
    : paid
      ? { background: '#e3f6ee', color: '#1f7a55' }
      : { background: '#fff4e0', color: '#b7791f' }
  const statusText = refunded ? 'ফেরত দেওয়া হয়েছে' : paid ? 'পরিশোধিত' : 'অপেক্ষমাণ'
  const taka = (n: number) => `৳${bnDigits(n.toLocaleString('en-US'))}`
  const year = bnDigits(new Date().getFullYear())

  return (
    <div
      ref={ref}
      // Inline background so it survives being cloned into an image.
      style={{ backgroundColor: '#fcfcfc', color: INK, fontFamily: BANGLA_FONT }}
      className="ticket-print relative overflow-hidden rounded-[24px] shadow-[0_26px_50px_rgba(0,0,0,0.5)]"
    >
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#002447] to-[#042a2b] px-5 pb-4 pt-4" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-between gap-3">
          <Logo tone="dark" className="h-6 w-auto" />
          <div className="flex flex-col items-end leading-none">
            <span className="text-[19px] font-bold text-white">বাস টিকেট</span>
            <span className="mt-1 text-[9.5px] font-bold tracking-[0.2em] text-[#c9dde6]">BUS TICKET</span>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <OperatorLogo logoUrl={booking.logoUrl} name={booking.companyName} variant="light" className="h-9 w-9 rounded-[10px]" />
          <div className="flex min-w-0 grow flex-col">
            <span className="display text-[14px] font-bold leading-tight text-white">{booking.busName}</span>
            <span className="truncate text-[11px] leading-tight text-[#c9dde6]">{booking.companyName}</span>
          </div>
          {busType && (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              {busType}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <Watermark />

        {/* Route */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 pb-3 pt-4" style={{ zIndex: 1 }}>
          <div className="flex min-w-0 flex-col">
            <span className="text-[10.5px] font-semibold" style={{ color: MUTED }}>যাত্রা শুরু</span>
            <span className="text-[26px] font-bold leading-tight">{city(booking.from)}</span>
            {dep !== null && (
              <span className="mt-0.5 flex flex-col leading-tight">
                <span className="text-[10px] font-semibold" style={{ color: MUTED }}>ছাড়বে</span>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: '#002447' }}>{bnClock(dep)}</span>
              </span>
            )}
          </div>
          <div className="flex w-[84px] flex-col items-center gap-1">
            <div className="flex w-full items-center gap-1">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#002447]" />
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
            {trip > 0 && (
              <span className="text-center text-[10px] font-semibold leading-tight" style={{ color: MUTED }}>{bnDuration(trip)}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col items-end text-right">
            <span className="text-[10.5px] font-semibold" style={{ color: MUTED }}>গন্তব্য</span>
            <span className="text-[26px] font-bold leading-tight">{city(booking.to)}</span>
            {arr !== null && (
              <span className="mt-0.5 flex flex-col items-end leading-tight">
                <span className="text-[10px] font-semibold" style={{ color: MUTED }}>পৌঁছাবে (আনুমানিক)</span>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: '#b8480f' }}>{bnClock(arr)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Where to board: typed once per trip by the admin and copied onto every ticket */}
        {booking.boardingPoint && (
          <div className="relative mx-5 mb-3.5 flex items-start gap-3 rounded-2xl border px-3.5 py-3" style={{ zIndex: 1, borderColor: '#d7e8ec', backgroundColor: 'rgba(233,244,243,0.92)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#002447" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 shrink-0">
              <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z" />
              <circle cx="12" cy="10" r="2.3" />
            </svg>
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[10.5px] font-semibold leading-tight" style={{ color: MUTED }}>
                বাস ছাড়বে যেখান থেকে
              </span>
              <span className="break-words text-[13.5px] font-bold leading-snug" style={{ color: INK }}>
                {booking.boardingPoint}
              </span>
            </div>
            {booking.boardingMapUrl && (
              <a
                href={booking.boardingMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="no-print shrink-0 self-center rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white"
                style={{ backgroundColor: '#002447' }}
              >
                ম্যাপ ↗
              </a>
            )}
          </div>
        )}

        {/* Journey details */}
        <div className="relative grid grid-cols-2 gap-x-3 gap-y-3 border-t border-dashed border-[#e6e0d6] px-5 py-3.5" style={{ zIndex: 1 }}>
          <Field label="যাত্রীর নাম" value={booking.passengerName} />
          <Field label="মোবাইল নম্বর" value={maskPhone(booking.passengerPhone)} align="right" />
          <Field label="ভ্রমণের তারিখ" value={bnDate(booking.date)} className="col-span-2" />
          <Field label="আসন নম্বর" value={booking.seats.join(', ')} />
          <Field label="মোট আসন" value={`${bnDigits(seatCount)}টি`} align="right" />
          <Field label="কাউন্টারে উপস্থিতি" value={`${reportBy}-এর মধ্যে (ছাড়ার ${bnDigits(REPORT_MINUTES)} মিনিট আগে)`} className="col-span-2" />
          {/* Its own row: a ticket code is long, and the conductor may type it in. */}
          <Field label="টিকেট নম্বর" value={booking.bookingCode} className="col-span-2" nowrap />
        </div>

        {/* Fare */}
        <div className="relative mx-5 rounded-2xl border border-[#ebe5dc] px-3.5 py-3" style={{ zIndex: 1, backgroundColor: 'rgba(244,246,246,0.92)' }}>
          <div className="flex items-center justify-between text-[12.5px]">
            <span style={{ color: MUTED }}>ভাড়া</span>
            <span className="font-semibold">
              {taka(perSeat)} × {bnDigits(seatCount)}টি আসন
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12.5px]">
            <span style={{ color: MUTED }}>পরিশোধের মাধ্যম</span>
            <span className="flex items-center gap-2 font-semibold">
              {method}
              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={statusStyle}>
                {statusText}
              </span>
            </span>
          </div>
          <div className="mt-2.5 flex items-end justify-between border-t border-[#e6e0d6] pt-2.5">
            <span className="text-[13px] font-bold">সর্বমোট পরিশোধ</span>
            <span className="text-[24px] font-bold leading-none">{taka(booking.totalPrice)}</span>
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
            <span className="text-[10.5px] font-semibold" style={{ color: '#b8480f' }}>
              অতিরিক্ত তথ্য
            </span>
            <span className="text-[13.5px] font-bold leading-snug">লাগেজ: {bagsText}</span>
          </div>
        </div>

        {/* Tear line */}
        <div className="relative mt-4 h-5" style={{ zIndex: 1 }}>
          <span className="ticket-notch absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-[#002447]" />
          <span className="ticket-notch absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-[#002447]" />
          <span className="absolute left-4 right-4 top-2.5 h-0.5 bg-[repeating-linear-gradient(90deg,#d6dcde_0_6px,transparent_6px_12px)]" />
        </div>

        {/* Boarding stub */}
        <div className="relative flex flex-col items-center gap-2 px-5 pb-4 pt-1 text-center" style={{ zIndex: 1 }}>
          <span className="text-[12px] font-semibold" style={{ color: MUTED }}>
            বাসে ওঠার সময় এই কোডটি দেখান
          </span>
          {booking.qrCode && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.qrCode}
                alt="টিকেটের কিউআর কোড"
                style={{ backgroundColor: '#ffffff' }}
                className="h-[150px] w-[150px] rounded-[16px] border border-[#ebe5dc] p-2"
              />
              {refunded && (
                <span
                  style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                  className="absolute inset-0 flex items-center justify-center rounded-[16px] text-[16px] font-bold text-[#d14343]"
                >
                  টিকেট বাতিল
                </span>
              )}
            </div>
          )}
          <span className="display text-[17px] font-bold tracking-[0.02em]">{booking.bookingCode}</span>
          <span className="max-w-[300px] text-[11.5px] leading-relaxed" style={{ color: '#6c7469' }}>
            সুপারভাইজার কোডটি স্ক্যান করলে BusHub-এ সঙ্গে সঙ্গে যাচাই হয়। অন্য কারো টিকেটের ছবি বা কপি দিয়ে বাসে ওঠা
            যাবে না। অনুগ্রহ করে {reportBy}-এর মধ্যে কাউন্টারে উপস্থিত থাকুন।
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between gap-2 border-t border-[#ebe5dc] bg-[#f4f6f6] px-5 py-2.5" style={{ zIndex: 1 }}>
        <Logo tone="light" className="h-5 w-auto" />
        <span className="text-right text-[10px] leading-snug" style={{ color: MUTED }}>
          <span className="whitespace-nowrap">© {year} BusHub · bushubbd.com</span>
          <br />
          <span className="whitespace-nowrap">সর্বস্বত্ব সংরক্ষিত · সহায়তা: {bnDigits(CONTACT_PHONE)}</span>
        </span>
      </div>

      {refunded && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
          <span
            className="rounded-xl border-4 px-5 py-1 text-[34px] font-bold"
            style={{ color: 'rgba(209,67,67,0.55)', borderColor: 'rgba(209,67,67,0.55)', transform: 'rotate(-18deg)' }}
          >
            ফেরত দেওয়া হয়েছে
          </span>
        </div>
      )}
    </div>
  )
})

export default Ticket
