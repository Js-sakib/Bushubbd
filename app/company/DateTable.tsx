'use client'

import { formatTripDate } from '@/lib/dates'
import { addMoney, taka } from '@/lib/tripMoney'
import { moneyByDateAndBus, type DayBusMoney } from './salesSheet'
import Plate from '../Plate'
import type { CompanyTrip } from './types'

const COLUMNS: { label: string; tone?: string; value: (m: ReturnType<typeof addMoney>, trips: number) => string }[] = [
  { label: 'Trips', value: (_, n) => String(n) },
  { label: 'Seats sold', value: (m) => `${m.seats.online + m.seats.counter}/${m.seats.total}` },
  { label: 'Counter', tone: 'text-[#2d7886]', value: (m) => taka(m.counter.total) },
  { label: 'BusHub sales', tone: 'text-[#0b7f8c]', value: (m) => taka(m.online.total) },
  { label: 'BusHub fee', value: (m) => taka(-m.online.fee) },
  { label: 'From BusHub', tone: 'text-[#0b7f8c]', value: (m) => taka(m.online.payout) },
  { label: 'Fuel', tone: 'text-[#c13b3b]', value: (m) => taka(m.costs.fuel) },
  { label: 'Road', tone: 'text-[#c13b3b]', value: (m) => taka(m.costs.road) },
  { label: 'Toll', tone: 'text-[#c13b3b]', value: (m) => taka(m.costs.toll) },
  { label: 'Other', tone: 'text-[#c13b3b]', value: (m) => taka(m.costs.other) },
  { label: 'You receive', value: (m) => taka(m.companyGets) },
]

/**
 * The money day by day and bus by bus as a table: sales, BusHub, each kind of cost and what is
 * left. Newest day first; a day with more than one bus gets its own total line.
 */
export default function DateTable({ trips }: { trips: CompanyTrip[] }) {
  const rows = moneyByDateAndBus(trips)
  const total = addMoney(rows.map((r) => r.m))
  if (rows.length === 0) return <div className="card-2 px-4 py-8 text-center text-sm text-[#4a4a4a]">No trips here.</div>
  const days = Array.from(new Set(rows.map((r) => r.date))).sort().reverse()

  const cells = (m: typeof total, n: number) => (
    <>
      {COLUMNS.map((c) => (
        <td key={c.label} className={`whitespace-nowrap px-2.5 py-2.5 text-right text-[12.5px] tabular-nums ${c.tone || 'text-[#222222]'}`}>
          {c.value(m, n)}
        </td>
      ))}
      <td className={`whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-bold tabular-nums ${m.left < 0 ? 'text-[#d23c3c]' : 'text-[#0a8a84]'}`}>{taka(m.left)}</td>
    </>
  )
  const sumRow = (key: string, label: string, sub: string, list: DayBusMoney[], strong: boolean) => (
    <tr key={key} className={`border-t border-[#c9d6e4] font-bold ${strong ? 'bg-[#feb249]/[0.08]' : 'bg-[#111111]/[0.05]'}`}>
      <th scope="row" className={`sticky left-0 z-10 px-3 py-2.5 text-left ${strong ? 'bg-[#f6efe6]' : 'bg-[#eef3f8]'}`}>
        <span className="block whitespace-nowrap text-[12.5px]">{label}</span>
        <span className="block whitespace-nowrap text-[10.5px] font-normal text-[#4a4a4a]">{sub}</span>
      </th>
      {cells(addMoney(list.map((r) => r.m)), list.reduce((n, r) => n + r.trips, 0))}
    </tr>
  )

  return (
    <div className="card-2 overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-[#c9d6e4] px-4 py-3">
        <span className="label-xs">Date by date · bus by bus</span>
        <span className="text-[11px] text-[#5e5e5e]">Each day&apos;s sales, BusHub money and costs for every bus. Slide sideways for every column.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5e5e5e]">
              <th className="sticky left-0 z-10 bg-[#f3f6fa] px-3 py-2.5 text-left">Date · bus</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-2.5 py-2.5 text-right leading-tight">
                  {c.label}
                </th>
              ))}
              <th className="px-2.5 py-2.5 text-right leading-tight">Left after costs</th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const [day, ...rest] = formatTripDate(date).split(' ')
              const dayRows = rows.filter((r) => r.date === date)
              return [
                ...dayRows.map((r) => (
                  <tr key={`${date}|${r.plateNumber}|${r.busName}`} className="border-t border-[#c9d6e4]">
                    <th scope="row" className="sticky left-0 z-10 bg-[#f3f6fa] px-3 py-2 text-left font-normal">
                      <span className="block whitespace-nowrap text-[11px] text-[#4a4a4a]">
                        {rest.join(' ')} · {day}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <Plate plate={r.plateNumber} />
                        <span className="max-w-[140px] truncate text-[12px] font-semibold text-[#161616]">{r.busName}</span>
                      </span>
                    </th>
                    {cells(r.m, r.trips)}
                  </tr>
                )),
                dayRows.length > 1 ? sumRow(`${date}|total`, `${rest.join(' ')} total`, `${day} · ${dayRows.length} buses`, dayRows, false) : null,
              ]
            })}
            {sumRow('total', 'Total', `${days.length} day${days.length === 1 ? '' : 's'}`, rows, true)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
