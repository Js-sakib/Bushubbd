'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Booking {
  bookingCode: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  passengerName: string
  paymentStatus: string
  status: string
  qrCode: string
  validUntil: string
}

function timeLeft(validUntil: string) {
  const ms = new Date(validUntil).getTime() - Date.now()
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided')
      setLoading(false)
      return
    }
    fetch(`/api/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setBooking(data.booking)
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading your ticket...</div>
  }

  if (error || !booking) {
    return (
      <div className="px-5 py-16">
        <div className="card mx-auto flex max-w-sm flex-col items-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold text-[#f87171]">Booking not found</h1>
          <p className="text-[13px] text-[#9ba7aa]">{error}</p>
          <a href="/" className="glass-btn glass-btn-plain h-11 text-sm">
            Back to home
          </a>
        </div>
      </div>
    )
  }

  const remaining = timeLeft(booking.validUntil)
  const paid = booking.paymentStatus === 'paid'

  return (
    <div className="px-5 pb-10 pt-5">
      <div className="flex items-center gap-3">
        <a href="/" aria-label="Back to home" className="icon-btn no-print">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M19 12H6" />
            <path d="m11.5 5.5-6 6.5 6 6.5" />
          </svg>
        </a>
        <span className="display grow text-[17px] font-bold">Your ticket</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
            paid ? 'bg-[#34d399]/[0.14] text-[#34d399]' : 'bg-[#f5a524]/[0.14] text-[#f5a524]'
          }`}
        >
          {paid ? 'Paid' : 'Payment pending'}
        </span>
        {booking.status === 'refunded' ? (
          <span className="inline-flex h-[30px] items-center rounded-full bg-[#f87171]/[0.14] px-3 text-xs font-bold text-[#f87171]">
            Refunded
          </span>
        ) : remaining ? (
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-[#f5a524]/[0.13] px-3 text-xs font-bold text-[#f5a524]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            Valid {remaining}
          </span>
        ) : (
          <span className="inline-flex h-[30px] items-center rounded-full bg-white/[0.07] px-3 text-xs font-bold text-[#c4cdcf]">
            Expired
          </span>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] bg-white text-[#16191a] shadow-[0_26px_50px_rgba(0,0,0,0.5)] sm:max-w-lg">
        <div className="flex items-center gap-3 bg-gradient-to-br from-[#0e3f43] to-[#16585d] px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          <div className="flex grow flex-col">
            <span className="display text-[15px] font-bold text-white">{booking.busName}</span>
            <span className="text-[11.5px] text-[#a9c6c8]">{booking.companyName}</span>
          </div>
          <span className="text-[11px] font-bold tracking-wider text-white">E-TICKET</span>
        </div>

        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="display text-2xl font-bold">{booking.departureTime}</span>
            <span className="text-[12.5px] font-bold">{booking.from}</span>
          </div>
          <div className="flex grow flex-col items-center gap-1">
            <div className="flex w-full items-center gap-1">
              <span className="h-[7px] w-[7px] rounded-full bg-[#0e3f43]" />
              <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_5px,transparent_5px_10px)]" />
              <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="3" y="4" width="18" height="12.5" rx="3" />
                <path d="M3 11h18" />
              </svg>
              <span className="h-0.5 grow bg-[repeating-linear-gradient(90deg,#c5ccce_0_5px,transparent_5px_10px)]" />
              <span className="h-[7px] w-[7px] rounded-full bg-[#f2661d]" />
            </div>
            <span className="text-[10.5px] font-semibold text-[#6c7679]">{booking.date}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7679]">Arriving</span>
            <span className="text-[12.5px] font-bold">{booking.to}</span>
          </div>
        </div>

        <div className="relative h-5">
          <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
          <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-[#0b0e0f]" />
          <span className="absolute left-4 right-4 top-2.5 h-0.5 bg-[repeating-linear-gradient(90deg,#d6dcde_0_6px,transparent_6px_12px)]" />
        </div>

        <div className="flex items-center gap-4 px-4 pb-5 pt-1">
          {booking.qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={booking.qrCode}
              alt="Ticket QR code"
              className="h-28 w-28 shrink-0 rounded-[14px] border border-[#e3e8e9] bg-white p-1.5"
            />
          )}
          <div className="flex grow flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7679]">Booking code</span>
              <span className="display text-[15px] font-bold">{booking.bookingCode}</span>
            </div>
            <div className="flex gap-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7679]">Seats</span>
                <span className="text-sm font-bold">{booking.seats.join(', ')}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7679]">Paid</span>
                <span className="text-sm font-bold">৳{booking.totalPrice}</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7679]">Passenger</span>
              <span className="text-[13.5px] font-semibold">{booking.passengerName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-[#e3e8e9] bg-[#f4f6f6] px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0e3f43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="M12 3 4 6v6c0 4.4 3.3 8.3 8 9 4.7-.7 8-4.6 8-9V6z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="text-[11.5px] leading-snug text-[#3e4749]">
            The conductor scans this code and checks it live. A screenshot of it will not pass.
          </span>
        </div>
      </div>

      <div className="no-print mt-5 flex flex-col gap-2.5 sm:max-w-lg">
        <button type="button" onClick={() => window.print()} className="glass-btn glass-btn-plain w-full">
          Print or save as PDF
        </button>
        <a href="/" className="glass-btn glass-btn-plain h-12 w-full text-sm">
          Book another ticket
        </a>
      </div>
    </div>
  )
}

export default function Confirmation() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
