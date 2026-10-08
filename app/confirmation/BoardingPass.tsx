'use client'

import { forwardRef } from 'react'
import OperatorLogo from '../OperatorLogo'
import Logo from '../BrandLogo'
import { CONTACT_PHONE } from '@/lib/site'
import { bnClock, bnDate, bnDigits, bnDuration } from '@/lib/bangla'
import { banglaCity } from '@/lib/routes'
import type { TicketBooking } from './Ticket'
import { watermark } from './watermark'

const INK = '#111111'
const MUTED = '#6b6f78'
const ORANGE = '#f2661d'
const BANGLA_FONT = 'var(--font-bangla), var(--font-body), sans-serif'
const REPORT_MINUTES = 30
/** The site's pink to aqua sky, as on every BusHub page. */
export const BRAND_SKY = 'linear-gradient(115deg, #d16ba5 0%, #aa8fd8 30%, #79b3f4 58%, #41dfff 82%, #5ffbf1 100%)'
const PAYMENT_NAMES: Record<string, string> = { bkash: 'বিকাশ', nagad: 'নগদ', card: 'কার্ড' }
const BUS_TYPES: Record<string, string> = { AC: 'এসি', 'Non-AC': 'নন-এসি', Sleeper: 'স্লিপার' }

/** Short codes for the big airline-style route line; other places use their first three letters. */
const CITY_CODES: Record<string, string> = {
  Dhaka: 'DHK',
  Chittagong: 'CTG',
  Chattogram: 'CTG',
  "Cox's Bazar": 'CXB',
  Sylhet: 'SYL',
  Rajshahi: 'RAJ',
  Khulna: 'KHL',
  Barishal: 'BSL',
  Barisal: 'BSL',
  Rangpur: 'RNG',
  Mymensingh: 'MYM',
  Cumilla: 'CML',
  Comilla: 'CML',
  Bogura: 'BOG',
  Jashore: 'JSR',
  Dinajpur: 'DNJ',
  Teknaf: 'TKF',
  Bandarban: 'BDB',
  Rangamati: 'RMT',
  Kuakata: 'KKT',
  Sreemangal: 'SRM',
}

export function cityCode(city: string): string {
  return CITY_CODES[city] || city.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || city
}

export function toMinutes(hhmm?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function maskPhone(phone?: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 7) return phone || '—'
  const local = d.startsWith('880') ? `0${d.slice(3)}` : d
  return bnDigits(`${local.slice(0, 3)}•••••${local.slice(-3)}`)
}

/** An airline-style label: small English capitals over the Bangla word. */
function Cell({ en, bn, value, big, accent, align = 'left', span = 1 }: { en: string; bn: string; value: string; big?: boolean; accent?: boolean; align?: 'left' | 'right' | 'center'; span?: number }) {
  return (
    <div className="flex min-w-0 flex-col" style={{ gridColumn: `span ${span}`, textAlign: align, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
      <span className="text-[9px] font-extrabold tracking-[0.14em]" style={{ color: MUTED, fontFamily: 'var(--font-body), sans-serif' }}>
        {en} <span className="font-semibold tracking-normal">· {bn}</span>
      </span>
      <span className={`${big ? 'text-[24px] leading-none' : 'text-[13.5px] leading-snug'} mt-1 break-words font-bold`} style={{ color: accent ? ORANGE : INK }}>
        {value}
      </span>
    </div>
  )
}

/**
 * The BusHub ticket as an airline boarding pass: shown on the phone at the bus door, saved as an
 * image or printed. Inline colours so the saved picture looks the same as the screen.
 */
const BoardingPass = forwardRef<HTMLDivElement, { booking: TicketBooking }>(function BoardingPass({ booking }, ref) {
  const refunded = booking.status === 'refunded'
  const paid = booking.paymentStatus === 'paid' && !refunded
  const dep = toMinutes(booking.departureTime)
  const arr = toMinutes(booking.arrivalTime)
  const trip = dep !== null && arr !== null ? (arr - dep + 1440) % 1440 : 0
  const reportBy = dep === null ? '—' : bnClock(dep - REPORT_MINUTES)
  const seatCount = booking.seats.length
  const taka = (n: number) => `৳${bnDigits(n.toLocaleString('en-US'))}`
  const method = booking.paymentMethod ? PAYMENT_NAMES[booking.paymentMethod] || booking.paymentMethod : ''
  const busType = booking.busType ? BUS_TYPES[booking.busType] || booking.busType : 'বাস'
  const status = refunded ? { t: 'ফেরত দেওয়া হয়েছে', bg: '#fde8e8', c: '#c53030' } : paid ? { t: 'পরিশোধিত', bg: '#e3f6ee', c: '#1f7a55' } : { t: 'অপেক্ষমাণ', bg: '#fff4e0', c: '#b7791f' }

  return (
    <div
      ref={ref}
      className="ticket-print relative overflow-hidden rounded-[26px]"
      style={{ backgroundColor: '#ffffff', backgroundImage: watermark('#4b3f8f', 0.07), color: INK, fontFamily: BANGLA_FONT, boxShadow: '0 24px 50px rgba(40,30,90,0.28)' }}
    >
      {/* Header: the site's sky, with the operator */}
      <div className="relative px-5 pb-4 pt-4" style={{ backgroundImage: BRAND_SKY }}>
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-xl px-2 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
            <Logo tone="light" className="h-5 w-auto" />
          </div>
          <div className="flex flex-col items-end leading-none" style={{ color: INK }}>
            <span className="text-[10px] font-extrabold tracking-[0.24em]" style={{ fontFamily: 'var(--font-body), sans-serif' }}>
              BOARDING PASS
            </span>
            <span className="mt-1 text-[16px] font-bold">বোর্ডিং পাস</span>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.88)' }}>
          <OperatorLogo logoUrl={booking.logoUrl} name={booking.companyName} variant="light" className="h-9 w-9 rounded-[10px]" />
          <div className="flex min-w-0 grow flex-col">
            <span className="display truncate text-[14px] font-bold leading-tight">{booking.busName}</span>
            <span className="truncate text-[11px] leading-tight" style={{ color: MUTED }}>
              {booking.companyName}
            </span>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, #feb249, ${ORANGE})` }}>
            {busType}
          </span>
        </div>
      </div>

      {/* Route, the way an airline prints it */}
      <div className="px-5 pb-2 pt-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex flex-col">
            <span className="display text-[40px] font-extrabold leading-none tracking-[0.02em]">{cityCode(booking.from)}</span>
            <span className="mt-1 text-[13px] font-bold">{banglaCity(booking.from) || booking.from}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex w-full items-center gap-1">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: '#aa8fd8' }} />
              <span className="h-0.5 grow" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9c4dc 0 4px,transparent 4px 8px)' }} />
              <svg viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0">
                <rect x="3" y="4" width="18" height="12.5" rx="3" />
                <path d="M3 11h18" />
                <circle cx="7.5" cy="19" r="1.6" />
                <circle cx="16.5" cy="19" r="1.6" />
              </svg>
              <span className="h-0.5 grow" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9c4dc 0 4px,transparent 4px 8px)' }} />
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: '#41dfff' }} />
            </div>
            {trip > 0 && (
              <span className="text-[10px] font-semibold" style={{ color: MUTED }}>
                {bnDuration(trip)}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="display text-[40px] font-extrabold leading-none tracking-[0.02em]">{cityCode(booking.to)}</span>
            <span className="mt-1 text-[13px] font-bold">{banglaCity(booking.to) || booking.to}</span>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[12px] font-bold">
          <span>{dep !== null ? `ছাড়বে ${bnClock(dep)}` : ''}</span>
          <span style={{ color: '#b8480f' }}>{arr !== null ? `পৌঁছাবে ~${bnClock(arr)}` : ''}</span>
        </div>
      </div>

      {/* The boarding details */}
      <div className="mx-5 mt-2 grid grid-cols-3 gap-x-3 gap-y-3.5 rounded-2xl px-3.5 py-3.5" style={{ backgroundColor: '#f6f4fb' }}>
        <Cell en="PASSENGER" bn="যাত্রী" value={booking.passengerName} span={2} />
        <Cell en="MOBILE" bn="মোবাইল" value={maskPhone(booking.passengerPhone)} align="right" />
        <Cell en="DATE" bn="তারিখ" value={bnDate(booking.date)} span={2} />
        <Cell en="DEPARTS" bn="ছাড়বে" value={dep === null ? booking.departureTime : bnClock(dep)} align="right" />
        <Cell en={seatCount > 1 ? 'SEATS' : 'SEAT'} bn="আসন" value={booking.seats.join(', ')} big accent />
        <Cell en="BOARDING" bn="উপস্থিতি" value={reportBy} align="center" />
        <Cell en="CLASS" bn="শ্রেণি" value={busType} align="right" />
        {booking.boardingPoint && (
          <div className="col-span-3 flex items-start justify-between gap-2 border-t pt-3" style={{ borderColor: '#e4e0ef' }}>
            <Cell en="BOARDING POINT" bn="যেখান থেকে উঠবেন" value={booking.boardingPoint} />
            {booking.boardingMapUrl && (
              <a href={booking.boardingMapUrl} target="_blank" rel="noopener noreferrer" className="no-print shrink-0 self-center rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white" style={{ background: `linear-gradient(135deg, #feb249, ${ORANGE})` }}>
                ম্যাপ ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* Fare */}
      <div className="mx-5 mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[11px]" style={{ color: MUTED }}>
            {taka(booking.pricePerSeat ?? Math.round(booking.totalPrice / Math.max(1, seatCount)))} × {bnDigits(seatCount)}টি আসন · {method}
          </span>
          <span className="mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: status.bg, color: status.c }}>
            {status.t}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold" style={{ color: MUTED }}>
            সর্বমোট
          </span>
          <span className="text-[24px] font-bold leading-none">{taka(booking.totalPrice)}</span>
        </div>
      </div>

      {/* Perforation */}
      <div className="relative mt-4 h-6">
        <span className="ticket-notch absolute -left-3 top-0 h-6 w-6 rounded-full" style={{ backgroundColor: '#b9a4dd' }} />
        <span className="ticket-notch absolute -right-3 top-0 h-6 w-6 rounded-full" style={{ backgroundColor: '#7fd7f5' }} />
        <span className="absolute left-5 right-5 top-3 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#d8d3e6 0 7px,transparent 7px 13px)' }} />
      </div>

      {/* Stub: what the supervisor scans */}
      <div className="relative flex items-center gap-4 px-5 pb-4 pt-1">
        {booking.qrCode && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={booking.qrCode} alt="টিকেটের কিউআর কোড" className="h-[132px] w-[132px] rounded-[16px] p-2" style={{ backgroundColor: '#ffffff', border: '2px solid #ece8f5' }} />
            {refunded && (
              <span className="absolute inset-0 flex items-center justify-center rounded-[16px] text-[15px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.88)', color: '#d14343' }}>
                টিকেট বাতিল
              </span>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[9px] font-extrabold tracking-[0.18em]" style={{ color: MUTED, fontFamily: 'var(--font-body), sans-serif' }}>
            SCAN TO BOARD
          </span>
          <span className="text-[13px] font-bold leading-snug">বাসে ওঠার সময় এই কোডটি দেখান</span>
          <span className="text-[10.5px] leading-snug" style={{ color: MUTED }}>
            {reportBy}-এর মধ্যে কাউন্টারে আসুন। ছবি বা কপি দিয়ে বাসে ওঠা যাবে না।
          </span>
        </div>
      </div>

      {/* Its own row: a ticket code is long, and the supervisor may type it in. */}
      <div className="mx-5 mb-4 flex items-center justify-between gap-2 rounded-xl px-3.5 py-2" style={{ backgroundColor: '#f6f4fb' }}>
        <span className="text-[9px] font-extrabold tracking-[0.14em]" style={{ color: MUTED, fontFamily: 'var(--font-body), sans-serif' }}>
          TICKET NO
        </span>
        <span className="display whitespace-nowrap text-[15px] font-bold tracking-[0.02em]">{booking.bookingCode}</span>
      </div>

      {/* Footer strip in the brand colours */}
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 text-[10.5px] font-semibold" style={{ backgroundImage: BRAND_SKY, color: INK }}>
        <span>bushubbd.com</span>
        <span>সহায়তা: {bnDigits(CONTACT_PHONE)}</span>
      </div>

      {refunded && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-xl border-4 px-5 py-1 text-[32px] font-bold" style={{ color: 'rgba(209,67,67,0.55)', borderColor: 'rgba(209,67,67,0.55)', transform: 'rotate(-18deg)' }}>
            ফেরত দেওয়া হয়েছে
          </span>
        </div>
      )}
    </div>
  )
})

export default BoardingPass
