'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'

interface VerifyResult {
  valid: boolean
  reason?: string
  bookingCode: string
  passengerName: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  validUntil: string
  checkedIn: boolean
  checkedInAt?: string
}

const REASON_LABELS: Record<string, string> = {
  unpaid: 'Payment was never completed for this ticket',
  expired: 'This ticket was for an earlier date and can no longer be used',
  cancelled: 'This ticket was cancelled',
  refunded: 'This ticket was refunded and is no longer valid',
}

export default function VerifyTicket() {
  const params = useParams()
  const code = params.code as string

  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/verify/${code}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        // Anything that isn't a real ticket payload (404, server error) is treated as not found,
        // so a partial response can never render as a half-valid ticket.
        if (!res.ok || !data || !Array.isArray(data.seats)) {
          setNotFound(true)
          return
        }
        setResult(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (code) load()
  }, [code])

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#4f5d75]">Checking ticket...</div>
  }

  if (notFound || !result) {
    return (
      <div className="mx-auto mt-6 max-w-md px-1">
        <div className="flex flex-col items-center gap-3 rounded-[22px] border-2 border-[#f87171] bg-[#f87171]/[0.08] p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f87171]/[0.15] text-[#d23c3c]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
            </svg>
          </span>
          <h1 className="text-2xl font-bold text-[#d23c3c]">Ticket not found</h1>
          <p className="text-[13px] leading-relaxed text-[#44526b]">
            This QR code does not match any real BusHub ticket. It may be fake or edited.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-md px-1">
      <div
        className={`flex flex-col items-center gap-3 rounded-[22px] border-2 p-7 text-center ${
          result.valid ? 'border-[#3fd0c9] bg-[#3fd0c9]/[0.08]' : 'border-[#f87171] bg-[#f87171]/[0.08]'
        }`}
      >
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            result.valid ? 'bg-[#3fd0c9]/[0.15] text-[#0a8a84]' : 'bg-[#f87171]/[0.15] text-[#d23c3c]'
          }`}
        >
          {result.valid ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M5 12.5 10 17l9-10" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
            </svg>
          )}
        </span>

        <h1 className={`text-2xl font-bold ${result.valid ? 'text-[#0a8a84]' : 'text-[#d23c3c]'}`}>
          {result.valid ? 'Valid ticket' : 'Not valid'}
        </h1>

        {!result.valid && (
          <p className="text-[13px] text-[#44526b]">
            {REASON_LABELS[result.reason || ''] || 'This ticket cannot be used.'}
          </p>
        )}

        {result.checkedIn && (
          <p className="text-[13px] font-semibold text-[#0b7f8c]">
            Already boarded {result.checkedInAt ? `at ${new Date(result.checkedInAt).toLocaleString()}` : ''}
          </p>
        )}

        <div className="mt-2 flex w-full flex-col gap-2.5 rounded-2xl border border-[#0b2545]/10 bg-white/60 p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Booking</span>
            <span className="display text-sm font-bold">{result.bookingCode}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Passenger</span>
            <span className="text-sm font-semibold">{result.passengerName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Bus</span>
            <span className="text-right text-sm font-semibold">
              {result.busName}
              <span className="block text-[11px] font-normal text-[#5a677d]">{result.companyName}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Route</span>
            <span className="text-sm font-semibold">
              {result.from} → {result.to}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Date</span>
            <span className="text-sm font-semibold">
              {formatTripDate(result.date)} · {result.departureTime}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#4f5d75]">Seats</span>
            <span className="text-sm font-bold text-[#0b7f8c]">{result.seats.join(', ')}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#c9d6e4] pt-2.5">
            <span className="text-xs text-[#4f5d75]">Valid until</span>
            <span className="text-[13px] font-semibold">
              {/* Always Dhaka time: a phone set to another zone must not show a different cutoff. */}
              {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(result.validUntil))}
              , {formatTripDate(dhakaDate(new Date(result.validUntil)))}
            </span>
          </div>
        </div>

        {result.valid && !result.checkedIn && (
          <p className="mt-1 text-[12px] leading-relaxed text-[#4f5d75]">
            Bus staff: board this passenger by scanning from the operator panel.
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-[#5a677d]">
        This status is checked live against BusHub&apos;s database — it cannot be faked by editing an image.
      </p>
    </div>
  )
}
