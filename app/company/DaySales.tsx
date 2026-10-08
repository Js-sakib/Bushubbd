'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import { downloadSheet, sheetDate } from '@/lib/sheet'
import { METHOD_LABEL, ReceiptPrinter, usePrinterWidth, type CounterTicketView, type DayTotals, type PrintJob } from './Receipt'
import CounterTicketSheet from './CounterTicketSheet'

const tk = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`
const timeOf = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))

interface DayData {
  day: string
  tickets: CounterTicketView[]
  totals: DayTotals
  staff: { id: string; name: string }[]
  me: { role: 'manager' | 'counter'; name: string }
}

/**
 * One day of counter sales: the money to hand over by cash, bKash and Nagad, every sale (open it
 * to cancel), the day-closing slip and an Excel file. A counter sees its own sales;
 * the manager sees every counter, or one.
 */
export default function DaySales({
  company,
  refreshKey,
  onOpen,
  onPrint,
}: {
  company: string
  refreshKey: number
  onOpen: (t: CounterTicketView) => void
  onPrint: (job: PrintJob) => void
}) {
  const [day, setDay] = useState(dhakaDate())
  const [staff, setStaff] = useState('')
  const [data, setData] = useState<DayData | null>(null)

  const load = useCallback(() => {
    fetch(`/api/company/counter-tickets?day=${day}${staff ? `&staff=${staff}` : ''}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.totals && setData(d))
      .catch(() => {})
  }, [day, staff])
  useEffect(load, [load, refreshKey])

  if (!data) return <div className="py-12 text-center text-sm text-[#4a4a4a]">Loading today’s sales…</div>
  const { totals: s } = data
  const companyName = data.tickets.find((t) => t.companyName)?.companyName || company
  const who = data.me.role === 'counter' ? data.me.name : staff ? data.staff.find((x) => x.id === staff)?.name || 'One counter' : 'All counters'

  const excel = () =>
    downloadSheet(`BusHub-counter-sales-${sheetDate(day)}${data.me.role === 'counter' ? `-${data.me.name}` : ''}`, [
      {
        name: 'Counter sales',
        title: `Counter sales · ${formatTripDate(day)}`,
        notes: [`${companyName} · ${who}`, `Cash ${tk(s.byMethod.cash)} · bKash ${tk(s.byMethod.bkash)} · Nagad ${tk(s.byMethod.nagad)} · Total ${tk(s.money)}`],
        columns: [
          { header: 'Sold at', kind: 'datetime' },
          { header: 'Sale no.' },
          { header: 'Route' },
          { header: 'Travel date', kind: 'date' },
          { header: 'Time' },
          { header: 'Bus' },
          { header: 'Seats' },
          { header: 'Seat count', kind: 'int', total: true },
          { header: 'Passenger' },
          { header: 'Phone' },
          { header: 'Fare', kind: 'money' },
          { header: 'Total', kind: 'money', total: true },
          { header: 'Paid by' },
          { header: 'TrxID' },
          { header: 'Discount note' },
          { header: 'Sold by' },
          { header: 'Status' },
          { header: 'Cancel reason', kind: 'wrap' },
        ],
        rows: data.tickets.map((t) => [
          t.soldAt,
          t.ticketCode,
          `${t.from} → ${t.to}`,
          t.date,
          t.departureTime,
          t.busName,
          t.seats.join(', '),
          t.status === 'cancelled' ? 0 : t.seats.length,
          t.passengerName || '',
          t.passengerPhone || '',
          t.fare,
          t.status === 'cancelled' ? 0 : t.total,
          METHOD_LABEL[t.paymentMethod],
          t.paymentRef || '',
          t.discountNote || '',
          t.soldBy,
          t.status === 'cancelled' ? 'Cancelled' : t.checkedIn ? 'Boarded' : 'Sold',
          t.cancelReason || '',
        ]),
      },
    ])

  const tiles: [string, string, string][] = [
    ['Sales', String(s.tickets), `${s.seats} seats`],
    ['Cash', tk(s.byMethod.cash), 'to hand over'],
    ['bKash', tk(s.byMethod.bkash), ''],
    ['Nagad', tk(s.byMethod.nagad), ''],
    ['Total', tk(s.money), s.cancelled ? `${s.cancelled} cancelled` : 'no cancellations'],
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Day
          <input type="date" value={day} max={dhakaDate()} onChange={(e) => e.target.value && setDay(e.target.value)} className="input-dark !h-11" />
        </label>
        {data.me.role === 'manager' && (
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            Counter
            <select value={staff} onChange={(e) => setStaff(e.target.value)} className="input-dark !h-11">
              <option value="">All counters</option>
              {data.staff.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => onPrint({ kind: 'closing', day, who, company: companyName, totals: s, tickets: data.tickets })} className="glass-btn h-11 px-4 text-[13px]">
            Print day closing
          </button>
          <button type="button" onClick={excel} disabled={data.tickets.length === 0} className="glass-btn glass-btn-plain h-11 px-4 text-[13px] disabled:opacity-50">
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map(([label, value, sub], i) => (
          <div key={label} className={`flex flex-col rounded-2xl p-3 ${i === 4 ? 'bg-gradient-to-br from-[#feb249] to-[#f2661d] text-[#1a0d03]' : 'glass-lite'} ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <span className="text-[11.5px] font-semibold opacity-80">{label}</span>
            <span className="display text-[20px] font-extrabold leading-tight">{value}</span>
            {sub && <span className="text-[11px] opacity-75">{sub}</span>}
          </div>
        ))}
      </div>

      {data.tickets.length === 0 ? (
        <p className="glass-lite p-6 text-center text-[13px] text-[#4a4a4a]">No counter sales {day === dhakaDate() ? 'yet today' : `on ${formatTripDate(day)}`}.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.tickets.map((t) => (
            <button
              key={t.ticketCode}
              type="button"
              onClick={() => onOpen(t)}
              className={`flex items-center gap-3 rounded-2xl border border-[#111111]/10 bg-white/75 px-3.5 py-3 text-left transition hover:bg-white ${t.status === 'cancelled' ? 'opacity-60' : ''}`}
            >
              <span className="w-[62px] shrink-0 text-[12px] font-bold text-[#3f3f3f]">{timeOf(t.soldAt)}</span>
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[13.5px] font-bold">
                  <span className="text-[#0a6e69]">{t.seats.join(', ')}</span> · {t.from} → {t.to} · {t.departureTime}
                </span>
                <span className="truncate text-[11.5px] text-[#4a4a4a]">
                  {t.ticketCode} · {t.passengerName || 'No name'}
                  {data.me.role === 'manager' ? ` · ${t.soldBy}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className={`text-[14px] font-extrabold ${t.status === 'cancelled' ? 'line-through' : ''}`}>{tk(t.total)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${t.status === 'cancelled' ? 'bg-[#f87171]/15 text-[#b42318]' : t.checkedIn ? 'bg-[#3fd0c9]/20 text-[#0a6e69]' : 'bg-[#111111]/[0.06] text-[#3f3f3f]'}`}>
                  {t.status === 'cancelled' ? 'Cancelled' : t.checkedIn ? 'Boarded' : METHOD_LABEL[t.paymentMethod]}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The manager's view of every counter's day, with its own sale sheet and day-closing printer. */
export function DaySalesPanel({ company }: { company: string }) {
  const [open, setOpen] = useState<CounterTicketView | null>(null)
  const [job, setJob] = useState<PrintJob | null>(null)
  const [width, setWidth] = usePrinterWidth()
  const [key, setKey] = useState(0)
  const done = useCallback(() => setJob(null), [])
  return (
    <div className="mt-1 flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1 text-[11.5px] font-bold" role="group" aria-label="Receipt printer width">
        <span className="px-2 text-[#4a4a4a]">Printer</span>
        {([58, 80] as const).map((w) => (
          <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} className={`h-7 rounded-full px-2.5 ${width === w ? 'bg-[#0a8a84] text-white' : 'bg-white/70 text-[#3f3f3f]'}`}>
            {w} mm
          </button>
        ))}
      </div>
      <DaySales company={company} refreshKey={key} onOpen={setOpen} onPrint={setJob} />
      {open && (
        <CounterTicketSheet
          ticket={open}
          canCancel
          onClose={() => setOpen(null)}
          onCancelled={() => {
            setOpen(null)
            setKey((k) => k + 1)
          }}
        />
      )}
      <ReceiptPrinter job={job} width={width} onDone={done} />
    </div>
  )
}
