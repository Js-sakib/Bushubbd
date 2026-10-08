'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { formatTripDate } from '@/lib/dates'
import { SITE_URL } from '@/lib/site'

/** A counter ticket as the counter page gets it from /api/company/counter-tickets. */
export interface CounterTicketView {
  ticketCode: string
  busId: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  busName: string
  plateNumber?: string
  boardingPoint?: string
  seats: string[]
  passengerName?: string
  passengerPhone?: string
  fare: number
  tripPrice: number
  total: number
  discountNote?: string
  paymentMethod: 'cash' | 'bkash' | 'nagad'
  paymentRef?: string
  received?: number
  soldBy: string
  staffId?: string
  soldAt: string
  status: 'sold' | 'cancelled'
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  checkedIn: boolean
  checkedInAt?: string
}

export interface DayTotals {
  tickets: number
  seats: number
  money: number
  byMethod: { cash: number; bkash: number; nagad: number }
  cancelled: number
  cancelledMoney: number
}

export type PrintJob =
  | { kind: 'ticket'; ticket: CounterTicketView; copy?: boolean }
  | { kind: 'closing'; day: string; who: string; company: string; totals: DayTotals; tickets: CounterTicketView[] }

export const METHOD_LABEL = { cash: 'Cash', bkash: 'bKash', nagad: 'Nagad' } as const

const tk = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`
const dhaka = (iso: string, withDate = true) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    ...(withDate ? { day: '2-digit', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))

/** 01712345678 → 0171••••678: enough for the passenger to recognise, not enough to copy. */
export const maskPhone = (p?: string) => (p && p.length >= 8 ? `${p.slice(0, 4)}••••${p.slice(-3)}` : p || '')

/** The receipt width the counter chose once (58 or 80 mm), remembered on this computer. */
export function usePrinterWidth(): [58 | 80, (w: 58 | 80) => void] {
  const [width, setWidth] = useState<58 | 80>(80)
  useEffect(() => {
    try {
      if (localStorage.getItem('bushub.printer') === '58') setWidth(58)
    } catch {}
  }, [])
  const choose = (w: 58 | 80) => {
    setWidth(w)
    try {
      localStorage.setItem('bushub.printer', String(w))
    } catch {}
  }
  return [width, choose]
}

/**
 * Prints one job on the counter's receipt printer, then calls onDone. The receipt is drawn at the
 * end of <body> and everything else is left out while printing (app/globals.css), black on white
 * only, sized for the printable width of a 58 mm (48 mm) or 80 mm (72 mm) roll.
 */
export function ReceiptPrinter({ job, width, onDone }: { job: PrintJob | null; width: 58 | 80; onDone: () => void }) {
  const [qr, setQr] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    setQr('')
    if (!job) return
    if (job.kind === 'ticket') {
      QRCode.toDataURL(`${SITE_URL}/verify/${job.ticket.ticketCode}`, { margin: 0, width: 300, errorCorrectionLevel: 'M' })
        .then((url) => {
          setQr(url)
          setReady(true)
        })
        .catch(() => setReady(true))
    } else setReady(true)
  }, [job])

  useEffect(() => {
    if (!job || !ready) return
    const done = () => {
      document.body.classList.remove('printing-receipt')
      window.removeEventListener('afterprint', done)
      onDone()
    }
    document.body.classList.add('printing-receipt')
    window.addEventListener('afterprint', done)
    // A moment for the QR image to be laid out before the print dialog takes its picture.
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('printing-receipt')
    }
  }, [job, ready, onDone])

  if (!job || typeof document === 'undefined') return null
  return createPortal(
    <div className="receipt-print">
      <style>{`@page { margin: 2mm; } .rc{width:${width === 58 ? 48 : 72}mm;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:${width === 58 ? 8.5 : 9.5}pt;line-height:1.3}`}</style>
      {job.kind === 'ticket' ? <TicketReceipt ticket={job.ticket} qr={qr} copy={job.copy} narrow={width === 58} /> : <ClosingReceipt job={job} />}
    </div>,
    document.body
  )
}

const Rule = () => <div style={{ borderTop: '1px dashed #000', margin: '1.6mm 0' }} />
const Line = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm', fontWeight: bold ? 700 : 400 }}>
    <span>{l}</span>
    <span style={{ textAlign: 'right' }}>{r}</span>
  </div>
)

function TicketReceipt({ ticket: t, qr, copy, narrow }: { ticket: CounterTicketView; qr: string; copy?: boolean; narrow: boolean }) {
  const change = t.paymentMethod === 'cash' && typeof t.received === 'number' ? t.received - t.total : null
  return (
    <div className="rc">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '8pt' }}>BusHub · bushubbd.com</div>
        <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>{t.companyName}</div>
        {copy && <div style={{ fontSize: '8pt', fontWeight: 700 }}>— COPY —</div>}
        {t.status === 'cancelled' && <div style={{ fontSize: '11pt', fontWeight: 700 }}>*** CANCELLED ***</div>}
      </div>
      <Rule />
      <div style={{ textAlign: 'center', fontSize: narrow ? '12pt' : '14pt', fontWeight: 700 }}>
        {t.from} → {t.to}
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700 }}>
        {formatTripDate(t.date)} · {t.departureTime}
      </div>
      <div style={{ textAlign: 'center' }}>
        {t.busName}
        {t.plateNumber ? ` · ${t.plateNumber}` : ''}
      </div>
      {t.boardingPoint && <div style={{ textAlign: 'center' }}>Boarding: {t.boardingPoint}</div>}
      <Rule />
      <div style={{ textAlign: 'center' }}>SEAT{t.seats.length === 1 ? '' : 'S'}</div>
      <div style={{ textAlign: 'center', fontSize: narrow ? '15pt' : '18pt', fontWeight: 700, letterSpacing: '0.5pt' }}>{t.seats.join(', ')}</div>
      {(t.passengerName || t.passengerPhone) && (
        <div style={{ textAlign: 'center', marginTop: '1mm' }}>
          {t.passengerName}
          {t.passengerName && t.passengerPhone ? ' · ' : ''}
          {maskPhone(t.passengerPhone)}
        </div>
      )}
      <Rule />
      <Line l={`Fare ${t.seats.length} × ${tk(t.fare)}`} r={tk(t.total)} />
      {t.fare < t.tripPrice && <Line l={`Discount (${t.discountNote || ''})`} r={`−${tk((t.tripPrice - t.fare) * t.seats.length)}`} />}
      <div style={{ fontSize: narrow ? '11pt' : '12.5pt' }}>
        <Line l="TOTAL" r={tk(t.total)} bold />
      </div>
      <Line l="Paid by" r={`${METHOD_LABEL[t.paymentMethod]}${t.paymentRef ? ` ${t.paymentRef}` : ''}`} />
      {change !== null && (
        <>
          <Line l="Received" r={tk(t.received || 0)} />
          <Line l="Change" r={tk(change)} />
        </>
      )}
      <Rule />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1mm' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="" style={{ width: narrow ? '26mm' : '30mm', height: narrow ? '26mm' : '30mm' }} />}
        <div style={{ fontWeight: 700, fontSize: narrow ? '8.5pt' : '9.5pt', letterSpacing: '0.3pt' }}>{t.ticketCode}</div>
      </div>
      <Rule />
      <div style={{ textAlign: 'center', fontSize: '8pt' }}>
        Sold by {t.soldBy} · {dhaka(t.soldAt)}
        <br />
        Show this ticket at the bus door. Valid for this trip only.
        <br />
        টিকেটটি বাসের দরজায় দেখান · bushubbd.com
      </div>
    </div>
  )
}

function ClosingReceipt({ job }: { job: Extract<PrintJob, { kind: 'closing' }> }) {
  const { totals: s } = job
  return (
    <div className="rc">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>DAY CLOSING</div>
        <div style={{ fontWeight: 700 }}>{job.company}</div>
        <div>
          {formatTripDate(job.day)} · {job.who}
        </div>
        <div style={{ fontSize: '8pt' }}>Printed {dhaka(new Date().toISOString())}</div>
      </div>
      <Rule />
      <Line l="Tickets" r={String(s.tickets)} />
      <Line l="Seats" r={String(s.seats)} />
      <Rule />
      <Line l="Cash" r={tk(s.byMethod.cash)} bold />
      <Line l="bKash" r={tk(s.byMethod.bkash)} />
      <Line l="Nagad" r={tk(s.byMethod.nagad)} />
      <div style={{ fontSize: '11pt' }}>
        <Line l="TOTAL" r={tk(s.money)} bold />
      </div>
      {s.cancelled > 0 && <Line l={`Cancelled (${s.cancelled})`} r={tk(s.cancelledMoney)} />}
      <Rule />
      {job.tickets.map((t) => (
        <div key={t.ticketCode} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5mm', fontSize: '8pt', textDecoration: t.status === 'cancelled' ? 'line-through' : 'none' }}>
          <span>
            {dhaka(t.soldAt, false)} {t.ticketCode.slice(-6)} {t.seats.join(',')}
          </span>
          <span>
            {tk(t.total)} {METHOD_LABEL[t.paymentMethod].slice(0, 5)}
          </span>
        </div>
      ))}
      <Rule />
      <div style={{ marginTop: '6mm', display: 'flex', justifyContent: 'space-between', fontSize: '8pt' }}>
        <span style={{ borderTop: '1px solid #000', paddingTop: '0.5mm', width: '45%', textAlign: 'center' }}>Counter</span>
        <span style={{ borderTop: '1px solid #000', paddingTop: '0.5mm', width: '45%', textAlign: 'center' }}>Manager</span>
      </div>
    </div>
  )
}
