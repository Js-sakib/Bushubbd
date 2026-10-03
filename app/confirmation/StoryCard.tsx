'use client'

import { forwardRef } from 'react'
import Logo from '../BrandLogo'
import { bnClock, bnDate, bnDigits } from '@/lib/bangla'
import { banglaCity } from '@/lib/routes'
import type { TicketBooking } from './Ticket'

const BANGLA_FONT = 'var(--font-bangla), var(--font-body), sans-serif'

function toMinutes(hhmm?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * A 9:16 picture of the trip for a Facebook or Instagram story. A story is public, so it
 * carries no QR code, ticket number, phone number or passenger name: nobody can board with it.
 * Drawn at 360×640 and captured at 3x for a 1080×1920 image.
 */
const StoryCard = forwardRef<HTMLDivElement, { booking: TicketBooking }>(function StoryCard({ booking }, ref) {
  const from = banglaCity(booking.from) || booking.from
  const to = banglaCity(booking.to) || booking.to
  const dep = toMinutes(booking.departureTime)
  const seats = booking.seats.length

  return (
    <div
      ref={ref}
      style={{
        width: 360,
        height: 640,
        fontFamily: BANGLA_FONT,
        color: '#e3dcd2',
        backgroundColor: '#002447',
        backgroundImage:
          'radial-gradient(circle at 12% 8%, rgba(242,102,29,0.55), transparent 42%), radial-gradient(circle at 95% 92%, rgba(83,211,209,0.45), transparent 45%), radial-gradient(circle at 80% 30%, rgba(254,178,73,0.12), transparent 40%)',
      }}
      className="relative flex flex-col items-center overflow-hidden px-6 pb-7 pt-8"
    >
      <Logo tone="dark" className="h-8 w-auto" />

      <span
        className="mt-5 rounded-full px-3.5 py-1 text-[12.5px] font-bold"
        style={{ backgroundColor: 'rgba(13,171,171,0.16)', color: '#5fdcd5', border: '1px solid rgba(13,171,171,0.35)' }}
      >
        ✓ টিকেট কনফার্মড
      </span>
      <span className="mt-3 text-[27px] font-bold leading-tight">আমার পরের যাত্রা</span>

      {/* The trip, as a tilted ticket */}
      <div
        className="relative mt-6 w-full overflow-hidden rounded-[22px]"
        style={{ backgroundColor: '#ffffff', color: '#100c0d', transform: 'rotate(-3deg)', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}
      >
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'linear-gradient(135deg,#002447,#042a2b)' }}>
          <span className="text-[14px] font-bold text-white">বাস টিকেট</span>
          <span className="text-[9px] font-bold tracking-[0.2em]" style={{ color: '#c9dde6' }}>BUSHUB</span>
        </div>
        <div className="px-4 pb-4 pt-3.5">
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-[10.5px] font-semibold" style={{ color: '#8a8f86' }}>যাত্রা শুরু</span>
              <span className="text-[26px] font-bold leading-tight">{from}</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 h-7 w-7 shrink-0">
              <rect x="3" y="4" width="18" height="12.5" rx="3" />
              <path d="M3 11h18" />
              <circle cx="7.5" cy="19" r="1.6" />
              <circle cx="16.5" cy="19" r="1.6" />
            </svg>
            <div className="flex min-w-0 flex-col items-end text-right">
              <span className="text-[10.5px] font-semibold" style={{ color: '#8a8f86' }}>গন্তব্য</span>
              <span className="text-[26px] font-bold leading-tight">{to}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashed pt-3" style={{ borderColor: '#e6e0d6' }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold" style={{ color: '#8a8f86' }}>তারিখ</span>
              <span className="text-[12.5px] font-bold leading-snug">{bnDate(booking.date)}</span>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-[10px] font-semibold" style={{ color: '#8a8f86' }}>ছাড়বে</span>
              <span className="text-[12.5px] font-bold leading-snug">{dep === null ? '—' : bnClock(dep)}</span>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#f4f6f6' }}>
              <span className="display min-w-0 truncate text-[12px] font-bold">{booking.busName}</span>
              <span className="shrink-0 text-[12px] font-bold" style={{ color: '#b8480f' }}>
                {bnDigits(seats)}টি আসন
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col items-center text-center">
        <span className="text-[18px] font-bold leading-snug">
          ঘরে বসেই টিকেট কেটেছি
          <br />
          <span style={{ color: '#feb249' }}>লাইন নেই, সিরিয়াল নেই</span>
        </span>
        <span className="mt-2 text-[12.5px]" style={{ color: '#cfc8bc' }}>
          আপনিও কাটুন নিজের পছন্দের সিট
        </span>
        <span
          className="display mt-4 rounded-full px-6 py-2.5 text-[20px] font-bold"
          style={{ background: 'linear-gradient(135deg,#f2661d,#feb249)', color: '#1a0d03', boxShadow: '0 12px 30px rgba(242,102,29,0.45)' }}
        >
          bushubbd.com
        </span>
      </div>
    </div>
  )
})

export default StoryCard
