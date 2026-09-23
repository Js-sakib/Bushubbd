'use client'

import { formatTripDate } from '@/lib/dates'
import { dhakaDate, type ScanResult } from '@/lib/scan'

export interface ScannedTicket {
  bookingCode: string
  passengerName: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  checkedInAt: string | null
}

export interface ScanResponse {
  result: ScanResult
  bookingCode: string | null
  ticket: ScannedTicket | null
}

type Tone = 'good' | 'warn' | 'bad'

const VERDICTS: Record<ScanResult, { tone: Tone; title: string; detail: string }> = {
  valid: { tone: 'good', title: 'Valid ticket', detail: 'Genuine and paid. Let the passenger board.' },
  wrong_day: { tone: 'warn', title: 'Not for today', detail: 'This is a genuine ticket, but for another day. Do not board.' },
  already_used: { tone: 'bad', title: 'Already used', detail: 'This ticket has boarded before. It may be a copy.' },
  expired: { tone: 'bad', title: 'Expired', detail: 'The travel date on this ticket has passed.' },
  unpaid: { tone: 'bad', title: 'Not paid', detail: 'Payment for this ticket was never completed.' },
  refunded: { tone: 'bad', title: 'Refunded', detail: 'This ticket was refunded and is no longer valid.' },
  cancelled: { tone: 'bad', title: 'Cancelled', detail: 'This ticket was cancelled.' },
  other_operator: { tone: 'bad', title: 'Not your bus', detail: 'This ticket is for a bus not linked to your account. If it is your bus, ask the BusHub team to link it.' },
  not_found: { tone: 'bad', title: 'Fake ticket', detail: 'No BusHub ticket matches this code. It may be forged.' },
}

const TONES: Record<Tone, { ring: string; bg: string; text: string; icon: string }> = {
  good: { ring: 'border-[#34d399]', bg: 'bg-[#34d399]/[0.09]', text: 'text-[#34d399]', icon: 'bg-[#34d399] text-[#062b1d]' },
  warn: { ring: 'border-[#f5a524]', bg: 'bg-[#f5a524]/[0.09]', text: 'text-[#f5a524]', icon: 'bg-[#f5a524] text-[#2b1a02]' },
  bad: { ring: 'border-[#f87171]', bg: 'bg-[#f87171]/[0.09]', text: 'text-[#f87171]', icon: 'bg-[#f87171] text-[#2b0909]' },
}

/** "07:12, Wed 23 Sep 2026" in Dhaka time, matching how dates read everywhere else. */
function dhakaTime(iso: string): string {
  const at = new Date(iso)
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' }).format(at)
  return `${clock}, ${formatTripDate(dhakaDate(at))}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[12px] text-[#8e9a9d]">{label}</span>
      <span className="text-right text-[13.5px] font-semibold">{children}</span>
    </div>
  )
}

export default function ScanResultCard({ scan }: { scan: ScanResponse }) {
  const verdict = VERDICTS[scan.result] ?? VERDICTS.not_found
  const tone = TONES[verdict.tone]
  const ticket = scan.ticket
  const passengers = ticket?.seats.length ?? 0

  return (
    <div className={`flex flex-col gap-4 rounded-[22px] border-2 p-5 ${tone.ring} ${tone.bg}`}>
      <div className="flex items-center gap-3.5">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
          {verdict.tone === 'good' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="M5 12.5 10 17l9-10" />
            </svg>
          ) : verdict.tone === 'warn' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="M12 8v5M12 16.5h.01" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          )}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className={`display text-[22px] font-bold leading-tight ${tone.text}`}>{verdict.title}</span>
          <span className="text-[12.5px] leading-snug text-[#c4cdcf]">{verdict.detail}</span>
        </div>
      </div>

      {scan.result === 'valid' && passengers > 0 && (
        <div className="rounded-2xl bg-[#34d399] px-4 py-3 text-center text-[#062b1d]">
          <span className="display text-[26px] font-bold leading-none">{passengers}</span>
          <span className="ml-2 text-[14px] font-bold">
            passenger{passengers === 1 ? '' : 's'} to board · seat{passengers === 1 ? '' : 's'} {ticket?.seats.join(', ')}
          </span>
        </div>
      )}

      {scan.result === 'already_used' && ticket?.checkedInAt && (
        <p className="rounded-xl bg-[#f87171]/[0.12] px-3.5 py-2.5 text-[13px] font-semibold text-[#fca5a5]">
          Boarded at {dhakaTime(ticket.checkedInAt)}
        </p>
      )}

      {ticket && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-[#2a3437] bg-[#0f1517] p-4">
          <Row label="Passenger">{ticket.passengerName}</Row>
          <Row label="Bus">{ticket.busName}</Row>
          <Row label="Route">
            {ticket.from} → {ticket.to}
          </Row>
          <Row label="Date">
            <span className={scan.result === 'wrong_day' ? 'text-[#f5a524]' : ''}>{formatTripDate(ticket.date)}</span>
          </Row>
          <Row label="Time">{ticket.departureTime}</Row>
          <Row label="Seats">
            {ticket.seats.join(', ')} <span className="text-[#8e9a9d]">({passengers})</span>
          </Row>
          <div className="border-t border-[#1f2729] pt-2.5">
            <Row label="Booking code">
              <span className="display">{ticket.bookingCode}</span>
            </Row>
          </div>
        </div>
      )}

      {!ticket && scan.bookingCode && (
        <p className="text-center text-[12px] text-[#8e9a9d]">
          Code scanned: <span className="display font-bold text-[#c4cdcf]">{scan.bookingCode}</span>
        </p>
      )}
    </div>
  )
}
