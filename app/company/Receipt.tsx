'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTripDate } from '@/lib/dates'

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

/** The day-closing slip: the counter's cash report for the manager. BusHub prints no tickets at
 * the counter; the bus company gives its own. */
export interface PrintJob {
  kind: 'closing'
  day: string
  who: string
  company: string
  totals: DayTotals
  tickets: CounterTicketView[]
}

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
 * Prints the day-closing slip on the counter's receipt printer, then calls onDone. The receipt is drawn at the
 * end of <body> and everything else is left out while printing (app/globals.css), black on white
 * only, sized for the printable width of a 58 mm (48 mm) or 80 mm (72 mm) roll.
 */
export function ReceiptPrinter({ job, width, onDone }: { job: PrintJob | null; width: 58 | 80; onDone: () => void }) {
  useEffect(() => {
    if (!job) return
    const done = () => {
      document.body.classList.remove('printing-receipt')
      window.removeEventListener('afterprint', done)
      onDone()
    }
    document.body.classList.add('printing-receipt')
    window.addEventListener('afterprint', done)
    // A moment for the slip to be laid out before the print dialog takes its picture.
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('printing-receipt')
    }
  }, [job, onDone])

  if (!job || typeof document === 'undefined') return null
  return createPortal(
    <div className="receipt-print">
      <style>{`@page { margin: 2mm; } ${receiptCss(width)}`}</style>
      <ClosingReceipt job={job} />
    </div>,
    document.body
  )
}

/** The receipt's page width (the printable part of a 58 or 80 mm roll) and type. */
export const receiptCss = (width: 58 | 80) =>
  `.rc{width:${width === 58 ? 48 : 72}mm;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:${width === 58 ? 8.5 : 9.5}pt;line-height:1.3}`

const Rule = () => <div style={{ borderTop: '1px dashed #000', margin: '1.6mm 0' }} />
const Line = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm', fontWeight: bold ? 700 : 400 }}>
    <span>{l}</span>
    <span style={{ textAlign: 'right' }}>{r}</span>
  </div>
)

function ClosingReceipt({ job }: { job: PrintJob }) {
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
      <Line l="Sales" r={String(s.tickets)} />
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
