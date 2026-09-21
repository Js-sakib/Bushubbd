'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

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
  expired: 'This ticket has expired (24-hour window passed)',
  cancelled: 'This ticket was cancelled',
  refunded: 'This ticket was refunded and is no longer valid',
}

export default function VerifyTicket() {
  const params = useParams()
  const code = params.code as string

  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

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

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res = await fetch(`/api/verify/${code}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not check in')
        return
      }
      toast.success('Passenger checked in')
      load()
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking ticket...</div>
  }

  if (notFound || !result) {
    return (
      <div className="mx-auto mt-6 max-w-md px-1">
        <div className="flex flex-col items-center gap-3 rounded-[22px] border-2 border-[#f87171] bg-[#f87171]/[0.08] p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f87171]/[0.15] text-[#f87171]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
            </svg>
          </span>
          <h1 className="text-2xl font-bold text-[#f87171]">Ticket not found</h1>
          <p className="text-[13px] leading-relaxed text-[#9ba7aa]">
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
          result.valid ? 'border-[#34d399] bg-[#34d399]/[0.08]' : 'border-[#f87171] bg-[#f87171]/[0.08]'
        }`}
      >
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            result.valid ? 'bg-[#34d399]/[0.15] text-[#34d399]' : 'bg-[#f87171]/[0.15] text-[#f87171]'
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

        <h1 className={`text-2xl font-bold ${result.valid ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
          {result.valid ? 'Valid ticket' : 'Not valid'}
        </h1>

        {!result.valid && (
          <p className="text-[13px] text-[#9ba7aa]">
            {REASON_LABELS[result.reason || ''] || 'This ticket cannot be used.'}
          </p>
        )}

        {result.checkedIn && (
          <p className="text-[13px] font-semibold text-[#f5a524]">
            Already checked in at {result.checkedInAt ? new Date(result.checkedInAt).toLocaleString() : ''}
          </p>
        )}

        <div className="mt-2 flex w-full flex-col gap-2.5 rounded-2xl border border-[#2a3437] bg-[#0f1517] p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Booking</span>
            <span className="display text-sm font-bold">{result.bookingCode}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Passenger</span>
            <span className="text-sm font-semibold">{result.passengerName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Bus</span>
            <span className="text-right text-sm font-semibold">
              {result.busName}
              <span className="block text-[11px] font-normal text-[#78868a]">{result.companyName}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Route</span>
            <span className="text-sm font-semibold">
              {result.from} → {result.to}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Date</span>
            <span className="text-sm font-semibold">
              {result.date} · {result.departureTime}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8e9a9d]">Seats</span>
            <span className="text-sm font-bold text-[#f5a524]">{result.seats.join(', ')}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#1f2729] pt-2.5">
            <span className="text-xs text-[#8e9a9d]">Expires</span>
            <span className="text-[13px] font-semibold">{new Date(result.validUntil).toLocaleString()}</span>
          </div>
        </div>

        {result.valid && !result.checkedIn && (
          <button onClick={handleCheckIn} disabled={checkingIn} className="glass-btn glass-btn-teal mt-2 w-full">
            <span className="icon-disc icon-disc-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12.5 10 17l9-10" />
              </svg>
            </span>
            {checkingIn ? 'Checking in...' : 'Check in passenger'}
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-[#78868a]">
        This status is checked live against BusHub&apos;s database — it cannot be faked by editing an image.
      </p>
    </div>
  )
}
