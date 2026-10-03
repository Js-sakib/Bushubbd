'use client'

import { formatTripDate } from '@/lib/dates'
import { addMoney, taka } from '@/lib/tripMoney'
import { moneyByDate } from './salesSheet'
import type { CompanyTrip } from './types'

const COLUMNS: { label: string; tone?: string; value: (m: ReturnType<typeof addMoney>, trips: number) => string }[] = [
  { label: 'Trips', value: (_, n) => String(n) },
  { label: 'Seats sold', value: (m) => `${m.seats.online + m.seats.counter}/${m.seats.total}` },
  { label: 'Counter', tone: 'text-[#c4b5fd]', value: (m) => taka(m.counter.total) },
  { label: 'BusHub sales', tone: 'text-[#f5a524]', value: (m) => taka(m.online.total) },
  { label: 'BusHub fee', value: (m) => taka(-m.online.fee) },
  { label: 'From BusHub', tone: 'text-[#f5a524]', value: (m) => taka(m.online.payout) },
  { label: 'Fuel', tone: 'text-[#fca5a5]', value: (m) => taka(m.costs.fuel) },
  { label: 'Road', tone: 'text-[#fca5a5]', value: (m) => taka(m.costs.road) },
  { label: 'Toll', tone: 'text-[#fca5a5]', value: (m) => taka(m.costs.toll) },
  { label: 'Other', tone: 'text-[#fca5a5]', value: (m) => taka(m.costs.other) },
  { label: 'You receive', value: (m) => taka(m.companyGets) },
]

/** The money day by day as a table: sales, BusHub, each kind of cost and what is left. Newest day first. */
export default function DateTable({ trips }: { trips: CompanyTrip[] }) {
  const days = moneyByDate(trips).reverse()
  const total = addMoney(days.map((d) => d.m))
  if (days.length === 0) return <div className="card-2 px-4 py-8 text-center text-sm text-[#8e9a9d]">No trips here.</div>

  const row = (key: string, label: string, sub: string, m: typeof total, n: number, strong = false) => (
    <tr key={key} className={`border-t border-[#1a2123] ${strong ? 'bg-white/[0.04] font-bold' : ''}`}>
      <th scope="row" className="sticky left-0 z-10 bg-[#121819] px-3 py-2.5 text-left">
        <span className="block whitespace-nowrap text-[12.5px]">{label}</span>
        <span className="block whitespace-nowrap text-[10.5px] font-normal text-[#6e7b7e]">{sub}</span>
      </th>
      {COLUMNS.map((c) => (
        <td key={c.label} className={`whitespace-nowrap px-2.5 py-2.5 text-right text-[12.5px] tabular-nums ${c.tone || 'text-[#c4cdcf]'}`}>
          {c.value(m, n)}
        </td>
      ))}
      <td className={`whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-bold tabular-nums ${m.left < 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{taka(m.left)}</td>
    </tr>
  )

  return (
    <div className="card-2 overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-[#1a2123] px-4 py-3">
        <span className="label-xs">Date by date</span>
        <span className="text-[11px] text-[#6e7b7e]">Each day&apos;s sales, BusHub money and costs. Slide sideways for every column.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6e7b7e]">
              <th className="sticky left-0 z-10 bg-[#121819] px-3 py-2.5 text-left">Date</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-2.5 py-2.5 text-right leading-tight">
                  {c.label}
                </th>
              ))}
              <th className="px-2.5 py-2.5 text-right leading-tight">Left after costs</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const [day, ...rest] = formatTripDate(d.date).split(' ')
              return row(d.date, rest.join(' '), day, d.m, d.trips)
            })}
            {row('total', 'Total', `${days.length} day${days.length === 1 ? '' : 's'}`, total, days.reduce((n, d) => n + d.trips, 0), true)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
