'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Ticket, { TicketBooking } from './Ticket'
import StoryCard from './StoryCard'
import ReviewForm from './ReviewForm'
import { saveTicket } from '../savedTickets'
import { MAX_SEATS_PER_BOOKING } from '@/lib/seats'
import { jpegToPdf } from '@/lib/pdf'

function timeLeft(validUntil: string) {
  const ms = new Date(validUntil).getTime() - Date.now()
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`
}

/** A 1x1 transparent PNG, used so one unreachable operator logo cannot fail the whole capture. */
/** Leaves out on-screen-only controls (such as the map button) from saved images and PDFs. */
const onScreenOnly = (node: HTMLElement) => !(node instanceof HTMLElement && node.classList.contains('no-print'))

const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')
  const returnBusId = searchParams.get('returnBusId')
  const passengers = Math.min(MAX_SEATS_PER_BOOKING, Math.max(1, Number(searchParams.get('passengers')) || 1))
  // Just bought (not opened again later): ask "did you save it?" before they leave.
  const fresh = searchParams.get('new') === '1'

  const ticketRef = useRef<HTMLDivElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const [booking, setBooking] = useState<TicketBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'download' | 'pdf' | 'share' | 'story' | null>(null)
  const [canShareFiles, setCanShareFiles] = useState(false)
  // Whether the passenger downloaded, shared or printed the ticket (or said they saved it).
  const [savedIt, setSavedIt] = useState(false)
  // Where they wanted to go when the "did you save it?" question came up.
  const [leaving, setLeaving] = useState<string | null>(null)

  const savedKey = booking ? `bushub.saved.${booking.bookingCode}` : ''
  const markSaved = useCallback(() => {
    setSavedIt(true)
    try {
      if (savedKey) localStorage.setItem(savedKey, '1')
    } catch {
      // Storage off: the question may come up again, nothing worse.
    }
  }, [savedKey])

  useEffect(() => {
    if (!savedKey) return
    try {
      if (localStorage.getItem(savedKey)) setSavedIt(true)
    } catch {
      // Storage off.
    }
  }, [savedKey])

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided')
      setLoading(false)
      return
    }
    fetch(`/api/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setBooking(data.booking)
        // Remember a paid ticket on this phone, so My tickets can list it even if it was never downloaded.
        const b = data.booking
        if (b?.paymentStatus === 'paid' && b.bookingCode) {
          saveTicket({
            bookingCode: b.bookingCode,
            from: b.from,
            to: b.to,
            date: b.date,
            departureTime: b.departureTime,
            seats: b.seats || [],
            companyName: b.companyName,
          })
        }
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
    // backgroundColor is written onto the captured root, which is the wrapper around the ticket,
    // so the saved image gets the dark backdrop the notches are cut from while the page shows
    // the glass background. (Put on the ticket itself, it would paint over the white card.)
    return toBlob(ticketRef.current, {
      pixelRatio: 2.5,
      backgroundColor: '#002447',
      cacheBust: true,
      imagePlaceholder: BLANK_PIXEL,
      filter: onScreenOnly,
    })
  }, [])

  /** Hands a finished file to the browser as a download. */
  const saveFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoking straight away can cancel the download on some mobile browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  // The ticket as an A4 PDF, drawn on white like the printout, saved straight to the phone.
  const handlePdf = async (): Promise<boolean> => {
    if (!booking || !ticketRef.current) return false
    setBusy('pdf')
    const node = ticketRef.current
    node.classList.add('pdf-capture')
    try {
      const { toCanvas } = await import('html-to-image')
      const canvas = await toCanvas(node, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        imagePlaceholder: BLANK_PIXEL,
        filter: onScreenOnly,
      })
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!jpeg) throw new Error('empty')
      const pdf = jpegToPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, `BusHub ticket ${booking.bookingCode}`)
      saveFile(pdf, `BusHub-ticket-${booking.bookingCode}.pdf`)
      toast.success('Ticket PDF downloaded')
      markSaved()
      return true
    } catch {
      toast.error('Could not make the PDF. Try Download image instead.')
      return false
    } finally {
      node.classList.remove('pdf-capture')
      setBusy(null)
    }
  }

  const handleDownload = async () => {
    if (!booking) return
    setBusy('download')
    try {
      const blob = await renderTicket()
      if (!blob) throw new Error('empty')
      saveFile(blob, `BusHub-ticket-${booking.bookingCode}.png`)
      toast.success('Ticket image downloaded')
      markSaved()
    } catch {
      toast.error('Could not save the image. Try Download PDF instead.')
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
      markSaved()
    } catch (err) {
      // A cancelled share sheet is not a failure worth shouting about.
      if ((err as Error)?.name !== 'AbortError') toast.error('Could not share the ticket')
    } finally {
      setBusy(null)
    }
  }

  // A story picture of the trip, without the QR code, ticket number or phone number.
  const handleStory = async () => {
    if (!booking || !storyRef.current) return
    setBusy('story')
    try {
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(storyRef.current, { pixelRatio: 3, cacheBust: true, imagePlaceholder: BLANK_PIXEL })
      if (!blob) throw new Error('empty')
      const file = new File([blob], `BusHub-story-${booking.from}-${booking.to}.png`, { type: 'image/png' })
      if (canShareFiles) {
        await navigator.share({ files: [file], title: 'BusHub' })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        toast.success('Story picture saved. Add it to your Facebook story.')
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error('Could not make the story picture')
    } finally {
      setBusy(null)
    }
  }

  // Right after buying, leaving the page (back button, a link, closing the tab) first asks whether
  // the ticket is saved. Once it is downloaded, shared, printed or they say yes, it never asks again.
  const guard = fresh && !!booking && booking.paymentStatus === 'paid' && booking.status !== 'refunded' && !savedIt
  useEffect(() => {
    if (!guard) return
    window.history.pushState({ bushubGuard: true }, '')
    const onBack = () => {
      window.history.pushState({ bushubGuard: true }, '')
      setLeaving('/')
    }
    const onLink = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download') || e.defaultPrevented) return
      const href = link.getAttribute('href') || ''
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      e.preventDefault()
      setLeaving(href)
    }
    const onClose = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('popstate', onBack)
    document.addEventListener('click', onLink, true)
    window.addEventListener('beforeunload', onClose)
    return () => {
      window.removeEventListener('popstate', onBack)
      document.removeEventListener('click', onLink, true)
      window.removeEventListener('beforeunload', onClose)
    }
  }, [guard])

  const leaveTo = (href: string) => {
    setLeaving(null)
    // The guard's listeners are gone once savedIt is set; go on to where they were heading.
    setTimeout(() => window.location.assign(href), 0)
  }
  const answerYes = () => {
    const to = leaving || '/'
    markSaved()
    leaveTo(to)
  }
  const answerNo = async () => {
    const to = leaving || '/'
    setLeaving(null)
    const ok = await handlePdf()
    if (ok) setTimeout(() => window.location.assign(to), 1500)
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading your ticket...</div>
  }

  if (error || !booking) {
    return (
      <div className="px-5 py-16">
        <div className="card mx-auto flex max-w-sm flex-col items-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold text-[#d23c3c]">Booking not found</h1>
          <p className="text-[13px] text-[#3f3f3f]">{error}</p>
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
    <div className="mx-auto w-full max-w-xl px-5 pb-10 pt-5">
      {leaving !== null && (
        <div className="no-print fixed inset-0 z-[70] flex items-end justify-center bg-[#111111]/45 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="save-question">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-[26px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#feb249]/30 text-[#c2410c]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M5 19.5h14" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="save-question" className="display text-[19px] font-bold">
                Did you save your ticket?
              </h2>
              <span className="text-[14px] font-semibold text-[#3f3f3f]">টিকেট সেভ করেছেন?</span>
              <p className="mt-1 text-[13px] leading-relaxed text-[#3f3f3f]">You need its QR code to board the bus. Save it now so you have it without internet.</p>
            </div>
            <button type="button" onClick={answerNo} className="glass-btn btn-orange h-12 text-sm">
              No, download it now · ডাউনলোড করুন
            </button>
            <button type="button" onClick={answerYes} className="glass-btn glass-btn-plain h-12 text-sm">
              Yes, I saved it · হ্যাঁ
            </button>
          </div>
        </div>
      )}

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
            paid ? 'bg-[#3fd0c9]/[0.14] text-[#0a8a84]' : 'bg-[#feb249]/[0.14] text-[#0b7f8c]'
          }`}
        >
          {paid ? 'Paid' : 'Payment pending'}
        </span>
        {booking.status === 'refunded' ? (
          <span className="inline-flex h-[30px] items-center rounded-full bg-[#f87171]/[0.14] px-3 text-xs font-bold text-[#d23c3c]">
            Refunded
          </span>
        ) : remaining ? (
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-[#feb249]/[0.13] px-3 text-xs font-bold text-[#0b7f8c]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            Valid {remaining}
          </span>
        ) : (
          <span className="inline-flex h-[30px] items-center rounded-full bg-[#111111]/[0.05] px-3 text-xs font-bold text-[#222222]">
            Expired
          </span>
        )}
      </div>

      {/* The capture wrapper carries the dark backdrop so the perforation notches, which are
          cut out in the page colour, blend in the saved image exactly as they do on screen. */}
      <div className="mt-4 sm:max-w-lg">
        {/* The margin stays outside the captured node, or it shows up as a blank strip in the image. */}
        <div ref={ticketRef} className="p-3">
          <Ticket booking={booking} />
        </div>
      </div>

      {/* Drawn off screen; only captured when the story button is used. */}
      <div aria-hidden className="no-print" style={{ position: 'fixed', left: -10000, top: 0 }}>
        <StoryCard ref={storyRef} booking={booking} />
      </div>

      <div className="no-print mt-5 flex flex-col gap-2.5 sm:max-w-lg">
        <span className="label-xs">Download your ticket · টিকেট ডাউনলোড</span>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={handlePdf} disabled={busy !== null} className="glass-btn h-12 whitespace-nowrap px-3 text-sm">
            <span className="icon-disc h-6 w-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M5 19.5h14" />
              </svg>
            </span>
            {busy === 'pdf' ? (
              'Making PDF...'
            ) : (
              <span>
                <span className="hidden min-[380px]:inline">Download </span>PDF
              </span>
            )}
          </button>
          <button type="button" onClick={handleDownload} disabled={busy !== null} className="glass-btn h-12 whitespace-nowrap px-3 text-sm">
            <span className="icon-disc h-6 w-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M5 19.5h14" />
              </svg>
            </span>
            {busy === 'download' ? (
              'Saving...'
            ) : (
              <span>
                <span className="hidden min-[380px]:inline">Download </span>
                <span className="min-[380px]:hidden">Image</span>
                <span className="hidden min-[380px]:inline">image</span>
              </span>
            )}
          </button>
        </div>

        <div className={`grid gap-2.5 ${canShareFiles ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canShareFiles && (
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
          )}
          <button
            type="button"
            onClick={() => {
              markSaved()
              window.print()
            }}
            className="glass-btn glass-btn-plain h-12 whitespace-nowrap px-3 text-sm"
          >
            Print
          </button>
        </div>

        <p className="text-center text-[11.5px] leading-snug text-[#555555]">
          Keep the PDF or image on your phone so you can board without internet.
        </p>

        {paid && booking.status !== 'refunded' && (
          <a href="/tickets" className="flex items-center gap-3 rounded-2xl border border-[#53d3d1]/60 bg-white/75 p-3.5 transition hover:border-[#f2661d]/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#53d3d1] text-[#111111]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] font-bold">Your ticket is saved · টিকেট সংরক্ষিত</span>
              <span className="text-[12px] leading-snug text-[#3f3f3f]">
                {booking.ticketEmailedAt || booking.ticketWhatsappedAt
                  ? `A copy was sent to your ${[booking.ticketWhatsappedAt && 'WhatsApp', booking.ticketEmailedAt && 'email'].filter(Boolean).join(' and ')}. `
                  : ''}
                Lost it later? Ask in <b>My tickets</b> and our team sends it to your WhatsApp or email.
              </span>
            </span>
          </a>
        )}

        {paid && booking.status !== 'refunded' && (
          <button
            type="button"
            onClick={handleStory}
            disabled={busy !== null}
            className="mt-1 flex h-14 w-full items-center justify-center gap-3 rounded-full text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#1877f2,#7b3fe4 55%,#e1306c)', boxShadow: '0 14px 30px rgba(123,63,228,0.35)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="9" strokeDasharray="4 2.5" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            {busy === 'story' ? 'Making your story...' : 'Share to Facebook story · স্টোরিতে দিন'}
          </button>
        )}
        {paid && booking.status !== 'refunded' && (
          <p className="text-center text-[11px] leading-snug text-[#555555]">
            The story picture shows your trip only. The QR code and ticket number stay private.
          </p>
        )}
      </div>

      {paid && booking.status !== 'refunded' && <ReviewForm bookingCode={booking.bookingCode} passengerName={booking.passengerName} />}

      {returnBusId && (
        <div className="no-print mt-5 flex flex-col gap-3 rounded-[20px] border border-[#c3d1e0] bg-gradient-to-br from-[#002447]/90 to-[#08324d]/90 p-4 sm:max-w-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#2dd4bf]/[0.16] text-[#0f8f80]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5" />
                <path d="M17 20V4M13.5 7.5 17 4l3.5 3.5" />
              </svg>
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">One leg to go</span>
              <span className="text-[12px] leading-snug text-[#303030]">
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
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
