'use client'

import { forwardRef } from 'react'
import Logo from '../BrandLogo'
import { bnClock, bnDate, bnDigits } from '@/lib/bangla'
import { banglaCity } from '@/lib/routes'
import { BRAND_SKY, cityCode, toMinutes } from './BoardingPass'
import type { TicketBooking } from './Ticket'
import RouteMap from './RouteMap'
import type { MapDetail } from '@/lib/bdMap'

const INK = '#111111'
const MUTED = '#6b6f78'
const ORANGE = '#f2661d'
const BANGLA_FONT = 'var(--font-bangla), var(--font-body), sans-serif'

/**
 * A 9:16 picture for a Facebook or Instagram story: the trip as a tilted boarding pass on the
 * site's sky. A story is public, so it has no QR code, ticket number, phone number or full name:
 * nobody can board with it. Drawn at 360×640 and saved at 3x (1080×1920).
 */
const TravelStory = forwardRef<HTMLDivElement, { booking: TicketBooking; mapDetail?: MapDetail }>(function TravelStory({ booking, mapDetail }, ref) {
  const to = banglaCity(booking.to) || booking.to
  const from = banglaCity(booking.from) || booking.from
  const dep = toMinutes(booking.departureTime)
  const firstName = (booking.passengerName || '').trim().split(/\s+/)[0] || ''

  return (
    <div ref={ref} className="relative flex flex-col items-center overflow-hidden px-6 pb-6 pt-5" style={{ width: 360, height: 640, fontFamily: BANGLA_FONT, color: INK, backgroundImage: BRAND_SKY }}>
      {/* Soft clouds and a sun, so the sky reads as travel */}
      <span aria-hidden className="absolute rounded-full" style={{ width: 220, height: 220, right: -70, top: -60, background: 'radial-gradient(circle, rgba(254,178,73,0.9), rgba(242,102,29,0.35) 55%, transparent 70%)' }} />
      <span aria-hidden className="absolute rounded-full" style={{ width: 300, height: 120, left: -90, top: 150, backgroundColor: 'rgba(255,255,255,0.22)', filter: 'blur(14px)' }} />
      <span aria-hidden className="absolute rounded-full" style={{ width: 260, height: 110, right: -80, bottom: 150, backgroundColor: 'rgba(255,255,255,0.25)', filter: 'blur(16px)' }} />

      <div className="relative rounded-2xl px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
        <Logo tone="light" className="h-6 w-auto" />
      </div>
      <span className="relative mt-3 text-[10px] font-extrabold tracking-[0.3em]" style={{ fontFamily: 'var(--font-body), sans-serif' }}>
        NEXT STOP
      </span>
      <span className="relative mt-1 text-center text-[31px] font-bold leading-[1.3]" style={{ textShadow: '0 2px 18px rgba(255,255,255,0.45)' }}>
        {to}
      </span>
      <span className="relative text-[13px] font-bold">{firstName ? `${firstName}-এর পরের যাত্রা` : 'আমার পরের যাত্রা'} ✨</span>

      {/* Where the trip goes, on the map */}
      <div className="relative mt-1">
        <RouteMap from={booking.from} to={booking.to} width={312} height={222} detail={mapDetail} />
      </div>

      {/* The pass, tilted, with no code on it */}
      <div className="relative mt-3 w-full shrink-0 overflow-hidden rounded-[20px]" style={{ backgroundColor: '#ffffff', transform: 'rotate(-2deg)', boxShadow: '0 26px 50px rgba(40,30,90,0.35)' }}>
        <div className="flex items-center justify-between px-4 py-1.5" style={{ background: `linear-gradient(135deg, #feb249, ${ORANGE})`, color: '#1a0d03' }}>
          <span className="text-[10px] font-extrabold tracking-[0.24em]" style={{ fontFamily: 'var(--font-body), sans-serif' }}>
            BOARDING PASS
          </span>
          <span className="text-[13px] font-bold">বোর্ডিং পাস</span>
        </div>
        <div className="px-4 pb-2 pt-2.5">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <div className="flex flex-col">
              <span className="display text-[28px] font-extrabold leading-none">{cityCode(booking.from)}</span>
              <span className="mt-0.5 text-[12px] font-bold">{from}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-0.5 grow" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9c4dc 0 4px,transparent 4px 8px)' }} />
              <svg viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0">
                <rect x="3" y="4" width="18" height="12.5" rx="3" />
                <path d="M3 11h18" />
                <circle cx="7.5" cy="19" r="1.6" />
                <circle cx="16.5" cy="19" r="1.6" />
              </svg>
              <span className="h-0.5 grow" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9c4dc 0 4px,transparent 4px 8px)' }} />
            </div>
            <div className="flex flex-col items-end">
              <span className="display text-[28px] font-extrabold leading-none">{cityCode(booking.to)}</span>
              <span className="mt-0.5 text-[12px] font-bold">{to}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#f6f4fb' }}>
            {[
              ['DATE', (bnDate(booking.date).split(',')[1] || '').trim().split(' ').slice(0, 2).join(' ') || bnDate(booking.date)],
              ['DEPARTS', dep === null ? booking.departureTime : bnClock(dep)],
              ['SEATS', `${bnDigits(booking.seats.length)}টি`],
            ].map(([en, v], i) => (
              <div key={en} className="flex flex-col" style={{ alignItems: i === 0 ? 'flex-start' : i === 1 ? 'center' : 'flex-end' }}>
                <span className="text-[8.5px] font-extrabold tracking-[0.14em]" style={{ color: MUTED, fontFamily: 'var(--font-body), sans-serif' }}>
                  {en}
                </span>
                <span className="text-[12.5px] font-bold leading-snug">{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* A stub where the code would be: says where the trip was booked instead */}
        <div className="relative h-4">
          <span className="absolute -left-2 top-0 h-4 w-4 rounded-full" style={{ backgroundColor: '#b9a4dd' }} />
          <span className="absolute -right-2 top-0 h-4 w-4 rounded-full" style={{ backgroundColor: '#7fd7f5' }} />
          <span className="absolute left-4 right-4 top-2 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#d8d3e6 0 6px,transparent 6px 11px)' }} />
        </div>
        <div className="truncate px-4 pb-2 pt-0 text-center text-[11px] font-bold" style={{ color: MUTED }}>
          ✓ টিকেট কনফার্মড · {booking.busName}
        </div>
      </div>

      <div className="relative mt-auto flex flex-col items-center text-center">
        <span className="display rounded-full px-6 py-2 text-[17px] font-bold" style={{ background: `linear-gradient(135deg, ${ORANGE}, #feb249)`, color: '#1a0d03', boxShadow: '0 12px 28px rgba(242,102,29,0.4)' }}>
          bushubbd.com
        </span>
      </div>
    </div>
  )
})

export default TravelStory
