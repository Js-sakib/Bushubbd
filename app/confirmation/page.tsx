'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Ticket, { TicketBooking } from './Ticket'

function timeLeft(validUntil: string) {
  const ms = new Date(validUntil).getTime() - Date.now()
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

/** A 1x1 transparent PNG, used so one unreachable operator logo cannot fail the whole capture. */
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')
  const returnBusId = searchParams.get('returnBusId')
  const passengers = Math.min(6, Math.max(1, Number(searchParams.get('passengers')) || 1))

  const ticketRef = useRef<HTMLDivElement>(null)
  const [booking, setBooking] = useState<TicketBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  const [canShareFiles, setCanShareFiles] = useState(false)

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

  useEffect(() => {
    // Sharing a file is a phone capability; hide the button where it cannot work.
    try {
      const probe = new File(['probe'], 'probe.png', { type: 'image/png' })
      setCanShareFiles(Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setCanShareFiles(false)
    }
  }, [])

  const renderTicket = useCallback(async (): Promise<Blob | null> => {
    if (!ticketRef.current) return null
    const { toBlob } = await import('html-to-image')
    // No backgroundColor option here: html-to-image writes it onto the ticket's own root node,
    // which would paint over the white card and leave the dark text unreadable.
    return toBlob(ticketRef.current, {
      pixelRatio: 2.5,
      cacheBust: true,
      imagePlaceholder: BLANK_PIXEL,
    })
  }, [])

  const handleDownload = async () => {
    if (!booking) return
    setBusy('download')
    try {
      const blob = await renderTicket()
      if (!blob) throw new Error('empty')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `BusHub-ticket-${booking.bookingCode}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoking straight away can cancel the download on some mobile browsers.
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      toast.success('Ticket saved to your device')
    } catch {
      toast.error('Could not save the image — use Print instead')
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (!booking) return
    setBusy('share')
    try {
      const blob = await renderTicket()
      if (!blob) throw new Error('empty')
      const file = new File([blob], `BusHub-ticket-${booking.bookingCode}.png`, { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: 'BusHub ticket',
        text: `${booking.from} → ${booking.to} · ${booking.date} · ${booking.bookingCode}`,
      })
    } catch (err) {
      // A cancelled share sheet is not a failure worth shouting about.
      if ((err as Error)?.name !== 'AbortError') toast.error('Could not share the ticket')
    } finally {
      setBusy(null)
    }
  }

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
      <div className="no-print flex items-center gap-3">
        <a href="/" aria-label="Back to home" className="icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M19 12H6" />
            <path d="m11.5 5.5-6 6.5 6 6.5" />
          </svg>
        </a>
        <span className="display grow text-[17px] font-bold">Your ticket</span>
      </div>

      <div className="no-print mt-3 flex flex-wrap gap-2">
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

      {/* The capture wrapper carries the dark backdrop so the perforation notches, which are
          cut out in the page colour, blend in the saved image exactly as they do on screen. */}
      <div className="mt-4 sm:max-w-lg">
        {/* The margin stays outside the captured node, or it shows up as a blank strip in the image. */}
        <div ref={ticketRef} className="p-3" style={{ backgroundColor: '#0b0e0f' }}>
          <Ticket booking={booking} />
        </div>
      </div>

      <div className="no-print mt-5 flex flex-col gap-2.5 sm:max-w-lg">
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={handleDownload} disabled={busy !== null} className="glass-btn h-12 whitespace-nowrap px-3 text-sm">
            <span className="icon-disc h-6 w-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M5 19.5h14" />
              </svg>
            </span>
            {busy === 'download' ? 'Saving...' : 'Save image'}
          </button>

          {canShareFiles ? (
            <button type="button" onClick={handleShare} disabled={busy !== null} className="glass-btn glass-btn-teal h-12 whitespace-nowrap px-3 text-sm">
              <span className="icon-disc icon-disc-teal h-6 w-6">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <circle cx="18" cy="5.5" r="2.5" />
                  <circle cx="6" cy="12" r="2.5" />
                  <circle cx="18" cy="18.5" r="2.5" />
                  <path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" />
                </svg>
              </span>
              {busy === 'share' ? 'Sharing...' : 'Share'}
            </button>
          ) : (
            <button type="button" onClick={() => window.print()} className="glass-btn glass-btn-plain h-12 whitespace-nowrap px-3 text-sm">
              Print / PDF
            </button>
          )}
        </div>

        {canShareFiles && (
          <button type="button" onClick={() => window.print()} className="glass-btn glass-btn-plain h-12 w-full text-sm">
            Print or save as PDF
          </button>
        )}

        <p className="text-center text-[11.5px] leading-snug text-[#78868a]">
          Save the image to your gallery so you can board without internet.
        </p>
      </div>

      {returnBusId && (
        <div className="no-print mt-5 flex flex-col gap-3 rounded-[20px] border border-[#1e4b4f] bg-gradient-to-br from-[#0e3f43]/90 to-[#141a1c]/90 p-4 sm:max-w-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#2dd4bf]/[0.16] text-[#2dd4bf]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5" />
                <path d="M17 20V4M13.5 7.5 17 4l3.5 3.5" />
              </svg>
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">One leg to go</span>
              <span className="text-[12px] leading-snug text-[#a9bbbc]">
                Your return from {booking.to} is still waiting. Pick those seats now.
              </span>
            </div>
          </div>
          <a
            href={`/booking?busId=${returnBusId}&passengers=${passengers}`}
            className="glass-btn glass-btn-teal h-12 w-full text-sm"
          >
            <span className="icon-disc icon-disc-teal h-6 w-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M5 12h13" />
                <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
              </svg>
            </span>
            Book my return
          </a>
        </div>
      )}

      <a href="/" className="no-print glass-btn glass-btn-plain mt-2.5 h-12 w-full text-sm sm:max-w-lg">
        Book another ticket
      </a>
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
