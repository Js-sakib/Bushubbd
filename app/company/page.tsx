'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'
import { formatTripDate } from '@/lib/dates'
import type { DayCount, ScanResult } from '@/lib/scan'
import QrCamera from './QrCamera'
import ScanResultCard, { ScanResponse } from './ScanResultCard'

interface RecentScan {
  id: string
  bookingCode: string | null
  result: ScanResult
  busName: string | null
  from: string | null
  to: string | null
  travelDate: string | null
  departureTime: string | null
  seatCount: number
  scannedAt: string
}

interface ScanStats {
  today: DayCount
  week: Omit<DayCount, 'date'>
  days: DayCount[]
  recent: RecentScan[]
}

interface Booking {
  _id: string
  bookingCode: string
  busId: string
  busName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  companyPayout: number
  passengerName: string
  passengerPhone: string
  paymentStatus: string
  status: string
}

const RESULT_CHIPS: Record<ScanResult, { label: string; className: string }> = {
  valid: { label: 'Boarded', className: 'bg-[#34d399]/[0.14] text-[#34d399]' },
  wrong_day: { label: 'Wrong day', className: 'bg-[#f5a524]/[0.14] text-[#f5a524]' },
  already_used: { label: 'Used twice', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  expired: { label: 'Expired', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  unpaid: { label: 'Not paid', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  refunded: { label: 'Refunded', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  other_operator: { label: 'Other company', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
  not_found: { label: 'Fake', className: 'bg-[#f87171]/[0.14] text-[#f87171]' },
}

const TABS = ['scan', 'history', 'sales'] as const

function dhakaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function OperatorScanner() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [companyEmail, setCompanyEmail] = useState('')
  const [tab, setTab] = useState<(typeof TABS)[number]>('scan')

  const [cameraOn, setCameraOn] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scan, setScan] = useState<ScanResponse | null>(null)

  const [stats, setStats] = useState<ScanStats | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])

  const loadStats = useCallback(() => {
    fetch('/api/scan')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== 'company') {
          router.push(companyPath('/company/login'))
          return
        }
        setCompanyEmail(data.email)
        setChecking(false)
        loadStats()
        fetch('/api/bookings')
          .then((r) => r.json())
          .then((d) => setBookings(d.bookings || []))
      })
  }, [router, loadStats])

  const checkTicket = useCallback(
    async (text: string) => {
      setCameraOn(false)
      setVerifying(true)
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.result) {
          toast.error(data?.error || 'Could not check the ticket. Check your internet and try again.')
          return
        }
        setScan(data)
        setManualCode('')
        // A buzz the supervisor can feel without looking: one for yes, three for no.
        navigator.vibrate?.(data.result === 'valid' ? 120 : [90, 60, 90, 60, 90])
        loadStats()
      } catch {
        toast.error('No internet connection. Try again in a moment.')
      } finally {
        setVerifying(false)
      }
    },
    [loadStats]
  )

  const scanNext = () => {
    setScan(null)
    setCameraOn(true)
  }

  const handleLogout = async () => {
    await fetch('/api/company/login', { method: 'DELETE' })
    router.push(companyPath('/company/login'))
  }

  if (checking) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking access...</div>
  }

  const paid = bookings.filter((b) => b.paymentStatus === 'paid' && b.status === 'confirmed')
  const totalPayout = paid.reduce((sum, b) => sum + (b.companyPayout || 0), 0)

  return (
    <div className="mx-auto max-w-xl pb-10">
      <div className="flex items-center gap-3 border-b border-[#1b2325] pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display text-[19px] font-bold leading-tight">Ticket scanner</h1>
          <span className="truncate text-[11.5px] text-[#78868a]">{companyEmail}</span>
        </div>
        <button type="button" onClick={handleLogout} className="chip">
          Logout
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-gradient-to-br from-[#12756c] to-[#0e5a54] p-4">
          <span className="text-[11.5px] font-bold text-[#b8ede6]">Boarded today</span>
          <span className="display text-3xl font-bold leading-none text-white">{stats?.today.passengers ?? '–'}</span>
          <span className="text-[11.5px] text-[#b8ede6]">
            {stats ? `${stats.today.tickets} ticket${stats.today.tickets === 1 ? '' : 's'} scanned` : 'passengers'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-gradient-to-br from-[#2f5bc4] to-[#24479b] p-4">
          <span className="text-[11.5px] font-bold text-[#c9d8fa]">Last 7 days</span>
          <span className="display text-3xl font-bold leading-none text-white">{stats?.week.passengers ?? '–'}</span>
          <span className="text-[11.5px] text-[#c9d8fa]">
            {stats ? `${stats.week.tickets} ticket${stats.week.tickets === 1 ? '' : 's'} scanned` : 'passengers'}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? 'chip-active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="mt-5 flex flex-col gap-4">
          {verifying && (
            <div className="flex aspect-[4/3] w-full items-center justify-center glass-lite text-sm text-[#9ba7aa]">
              Checking ticket...
            </div>
          )}

          {!verifying && scan && (
            <>
              <ScanResultCard scan={scan} />
              <button type="button" onClick={scanNext} className="glass-btn w-full">
                <span className="icon-disc">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
                  </svg>
                </span>
                Scan next ticket
              </button>
            </>
          )}

          {!verifying && !scan && cameraOn && (
            <>
              <QrCamera onDetected={checkTicket} />
              <button type="button" onClick={() => setCameraOn(false)} className="glass-btn glass-btn-plain h-12 w-full text-sm">
                Close camera
              </button>
            </>
          )}

          {!verifying && !scan && !cameraOn && (
            <button
              type="button"
              onClick={() => setCameraOn(true)}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed border-[#f5a524]/50 bg-[#f5a524]/[0.05] transition hover:bg-[#f5a524]/[0.09]"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#170b02] shadow-[0_12px_30px_rgba(242,102,29,0.35)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                  <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
                  <path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 13v3" />
                </svg>
              </span>
              <span className="display text-[20px] font-bold">Tap to scan a ticket</span>
              <span className="text-[12.5px] text-[#9ba7aa]">Point the camera at the passenger&apos;s QR code</span>
            </button>
          )}

          {!verifying && !scan && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (manualCode.trim()) checkTicket(manualCode)
              }}
              className="flex flex-col gap-2.5 glass-lite p-4"
            >
              <label htmlFor="manual-code" className="label-xs">
                Or type the booking code
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="BH-20260925-K7M2P"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="input-dark min-w-0 grow font-mono"
                />
                <button type="submit" disabled={!manualCode.trim()} className="glass-btn h-12 shrink-0 px-5 text-sm">
                  Check
                </button>
              </div>
            </form>
          )}

          <p className="rounded-2xl border border-[#1e4b4f] bg-[#0e3f43]/40 px-4 py-3 text-[12px] leading-relaxed text-[#a9bbbc]">
            Need to add a bus, change a time, or mark seats sold at your counter? Message the BusHub team at{' '}
            <a href="mailto:info@bushubbd.com" className="font-bold text-[#2dd4bf]">
              info@bushubbd.com
            </a>{' '}
            and we will update it for you.
          </p>
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="card-2 overflow-hidden">
            <div className="border-b border-[#1a2123] px-4 py-3">
              <span className="label-xs">Passengers boarded, by day</span>
            </div>
            {(stats?.days ?? []).map((day, index) => (
              <div key={day.date} className="flex items-center gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0">
                <div className="flex grow flex-col">
                  <span className="text-[13.5px] font-semibold">{index === 0 ? 'Today' : formatTripDate(day.date)}</span>
                  <span className="text-[11.5px] text-[#78868a]">
                    {day.tickets} ticket{day.tickets === 1 ? '' : 's'}
                    {day.rejected > 0 ? ` · ${day.rejected} rejected` : ''}
                  </span>
                </div>
                <span className="display text-[20px] font-bold text-[#34d399]">{day.passengers}</span>
              </div>
            ))}
            {!stats && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">Loading...</div>}
          </div>

          <div className="card-2 overflow-hidden">
            <div className="border-b border-[#1a2123] px-4 py-3">
              <span className="label-xs">Recent scans</span>
            </div>
            {(stats?.recent ?? []).map((item) => {
              const chip = RESULT_CHIPS[item.result] ?? RESULT_CHIPS.not_found
              return (
                <div key={item.id} className="flex items-start gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0">
                  <span className="w-11 shrink-0 pt-0.5 text-[12px] font-semibold text-[#9ba7aa]">{dhakaClock(item.scannedAt)}</span>
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold">
                      {item.busName ? `${item.busName} · ${item.from} → ${item.to}` : item.bookingCode || 'Unreadable code'}
                    </span>
                    {item.travelDate && (
                      <span className="text-[11.5px] text-[#78868a]">
                        {formatTripDate(item.travelDate)} · {item.departureTime} · {item.seatCount} seat{item.seatCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.className}`}>{chip.label}</span>
                </div>
              )
            })}
            {stats && stats.recent.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No tickets scanned in the last 7 days.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-[18px] bg-gradient-to-br from-[#c77a0e] to-[#a25f06] p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-bold text-[#fae3bc]">BusHub owes you</span>
              <span className="display text-[26px] font-bold leading-tight text-white">৳{totalPayout.toLocaleString()}</span>
            </div>
            <span className="text-right text-[12px] text-[#fae3bc]">
              {paid.length} ticket{paid.length === 1 ? '' : 's'}
              <br />
              sold online
            </span>
          </div>

          <div className="card-2 overflow-hidden">
            {bookings.map((b) => (
              <div key={b._id} className="flex items-start gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">
                    {b.from} → {b.to}
                  </span>
                  <span className="text-[11.5px] text-[#78868a]">
                    {formatTripDate(b.date)} · {b.departureTime} · seats {b.seats.join(', ')}
                  </span>
                  <span className="text-[11.5px] text-[#78868a]">{b.passengerName}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[13px] font-bold text-[#34d399]">৳{b.companyPayout ?? b.totalPrice}</span>
                  <span className="text-[11px] text-[#78868a]">
                    {b.status === 'refunded' ? 'Refunded' : b.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            ))}
            {bookings.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No tickets sold yet.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
