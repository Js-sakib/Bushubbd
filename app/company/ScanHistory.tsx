'use client'

import { useState } from 'react'
import { formatTripDate } from '@/lib/dates'
import { matches } from '@/lib/search'
import SearchBox from '../SearchBox'
import type { DayCount, ScanResult, ScannerCount } from '@/lib/scan'
import { downloadSheet, sheetDate } from '@/lib/sheet'

export interface RecentScan {
  id: string
  bookingCode: string | null
  result: ScanResult
  busName: string | null
  from: string | null
  to: string | null
  travelDate: string | null
  departureTime: string | null
  seatCount: number
  scannerName?: string | null
  scannedAt: string
}

export interface ScanStats {
  today: DayCount
  week: Omit<DayCount, 'date'>
  days: DayCount[]
  recent: RecentScan[]
  /** Manager only: the same counts per scanner login. */
  byScanner?: ScannerCount[]
}

const RESULT_CHIPS: Record<ScanResult, { label: string; className: string }> = {
  valid: { label: 'Boarded', className: 'bg-[#3fd0c9]/[0.14] text-[#0a8a84]' },
  wrong_day: { label: 'Wrong day', className: 'bg-[#feb249]/[0.14] text-[#0b7f8c]' },
  already_used: { label: 'Used twice', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  expired: { label: 'Expired', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  unpaid: { label: 'Not paid', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  refunded: { label: 'Refunded', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  other_operator: { label: 'Other company', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
  not_found: { label: 'Fake', className: 'bg-[#f87171]/[0.14] text-[#d23c3c]' },
}

function dhakaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** The manager's scans as an Excel file: boardings by day, by scanner, and every recent scan. */
function downloadScans(stats: ScanStats) {
  const problems = Object.entries(RESULT_CHIPS)
    .filter(([result]) => result !== 'valid')
    .map(([, chip]) => chip.label)
  const days = stats.days.map((d) => d.date).sort()
  const notes = days.length ? [`Last 7 days: ${sheetDate(days[0])} to ${sheetDate(days[days.length - 1])}`] : []
  downloadSheet(
    `BusHub-scans-${sheetDate(stats.today.date)}`,
    [
      {
        name: 'By day',
        title: 'Passengers boarded, by day',
        notes,
        columns: [
          { header: 'Date', kind: 'date' },
          { header: 'Tickets boarded', kind: 'int', total: true },
          { header: 'Passengers', kind: 'int', total: true },
          { header: 'Turned away', kind: 'int', total: true, highlight: { above: 0 } },
        ],
        rows: [...stats.days].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [d.date, d.tickets, d.passengers, d.rejected]),
      },
      ...(stats.byScanner?.length
        ? [
            {
              name: 'By scanner',
              title: 'Each scanner · last 7 days',
              notes,
              columns: [
                { header: 'Scanner' },
                { header: 'Tickets today', kind: 'int' as const, total: true },
                { header: 'Passengers today', kind: 'int' as const, total: true },
                { header: 'Tickets, 7 days', kind: 'int' as const, total: true },
                { header: 'Passengers, 7 days', kind: 'int' as const, total: true },
                { header: 'Turned away, 7 days', kind: 'int' as const, total: true },
              ],
              rows: stats.byScanner.map((r) => [r.name, r.today.tickets, r.today.passengers, r.week.tickets, r.week.passengers, r.week.rejected]),
            },
          ]
        : []),
      {
        name: 'Latest scans',
        title: 'The latest 50 scans',
        notes: [...notes, 'Red = the ticket was turned away.'],
        columns: [
          { header: 'Scanned at', kind: 'datetime' },
          { header: 'Ticket' },
          { header: 'Result', highlight: { equals: problems } },
          { header: 'Bus' },
          { header: 'From' },
          { header: 'To' },
          { header: 'Travel date', kind: 'date' },
          { header: 'Time' },
          { header: 'Passengers', kind: 'int', total: true },
          { header: 'Scanner' },
        ],
        rows: stats.recent.map((r) => [
          r.scannedAt,
          r.bookingCode || '',
          RESULT_CHIPS[r.result]?.label || r.result,
          r.busName || '',
          r.from || '',
          r.to || '',
          r.travelDate || '',
          r.departureTime || '',
          r.result === 'valid' ? r.seatCount : 0,
          r.scannerName || '',
        ]),
      },
    ],
    {
      summary: {
        title: 'Boarding scans',
        notes,
        items: [
          { label: 'Passengers boarded today', value: stats.today.passengers },
          { label: 'Tickets boarded today', value: stats.today.tickets },
          { label: 'Passengers boarded, 7 days', value: stats.week.passengers },
          { label: 'Tickets boarded, 7 days', value: stats.week.tickets },
          { label: 'Turned away, 7 days', value: stats.week.rejected },
        ],
      },
    }
  )
}

/** Boardings by day and the latest scans; the manager also sees which scanner did each. */
export default function ScanHistory({ stats, showScanner = false }: { stats: ScanStats | null; showScanner?: boolean }) {
  const [search, setSearch] = useState('')
  // The manager's page is wide on a computer: counts on the left, the latest scans on the right.
  return (
    <div className={`mt-5 flex flex-col gap-4 ${showScanner ? 'lg:grid lg:grid-cols-2 lg:items-start' : ''}`}>
      <div className="flex flex-col gap-4">
          {showScanner && stats?.byScanner && (
            <div className="card-2 overflow-hidden">
              <div className="border-b border-[#c9d6e4] px-4 py-3">
                <span className="label-xs">Each scanner · passengers boarded</span>
              </div>
              {stats.byScanner.map((row, i) => (
                <div key={`${row.name}-${i}`} className="flex items-center gap-3 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0">
                  <div className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-[#0f8f80]">{row.name}</span>
                    <span className="text-[11.5px] text-[#555555]">
                      7 days: {row.week.passengers} passenger{row.week.passengers === 1 ? '' : 's'} · {row.week.tickets} ticket{row.week.tickets === 1 ? '' : 's'}
                      {row.week.rejected > 0 ? ` · ${row.week.rejected} rejected` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="display text-[20px] font-bold leading-none text-[#0a8a84]">{row.today.passengers}</span>
                    <span className="text-[10.5px] text-[#4a4a4a]">today</span>
                  </div>
                </div>
              ))}
              {stats.byScanner.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#4a4a4a]">No scans in the last 7 days.</div>
              )}
            </div>
          )}

          <div className="card-2 overflow-hidden">
            <div className="border-b border-[#c9d6e4] px-4 py-3">
              <span className="label-xs">Passengers boarded, by day</span>
            </div>
            {(stats?.days ?? []).map((day, index) => (
              <div key={day.date} className="flex items-center gap-3 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0">
                <div className="flex grow flex-col">
                  <span className="text-[13.5px] font-semibold">{index === 0 ? 'Today' : formatTripDate(day.date)}</span>
                  <span className="text-[11.5px] text-[#555555]">
                    {day.tickets} ticket{day.tickets === 1 ? '' : 's'}
                    {day.rejected > 0 ? ` · ${day.rejected} rejected` : ''}
                  </span>
                </div>
                <span className="display text-[20px] font-bold text-[#0a8a84]">{day.passengers}</span>
              </div>
            ))}
            {!stats && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">Loading...</div>}
          </div>

      </div>
          <div className="card-2 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#c9d6e4] px-4 py-2.5">
              <span className="label-xs">Recent scans</span>
              {showScanner && stats && (
                <button type="button" onClick={() => downloadScans(stats)} className="glass-btn glass-btn-plain h-9 px-3.5 text-[12.5px]">
                  ⬇ Excel
                </button>
              )}
            </div>
            {(stats?.recent.length || 0) > 4 && (
              <div className="border-b border-[#c9d6e4] px-3 py-2.5">
                <SearchBox value={search} onChange={setSearch} placeholder="Search ticket code, bus, route, scanner" />
              </div>
            )}
            {(stats?.recent ?? [])
              .filter((item) => matches(search, item.bookingCode, item.busName, item.from, item.to, item.travelDate, item.scannerName, RESULT_CHIPS[item.result]?.label))
              .map((item) => {
              const chip = RESULT_CHIPS[item.result] ?? RESULT_CHIPS.not_found
              return (
                <div key={item.id} className="flex items-start gap-3 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0">
                  <span className="w-11 shrink-0 pt-0.5 text-[12px] font-semibold text-[#3f3f3f]">{dhakaClock(item.scannedAt)}</span>
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold">
                      {item.busName ? `${item.busName} · ${item.from} → ${item.to}` : item.bookingCode || 'Unreadable code'}
                    </span>
                    {item.travelDate && (
                      <span className="text-[11.5px] text-[#555555]">
                        {formatTripDate(item.travelDate)} · {item.departureTime} · {item.seatCount} seat{item.seatCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {showScanner && item.scannerName && <span className="text-[11px] text-[#5e5e5e]">Scanned by {item.scannerName}</span>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.className}`}>{chip.label}</span>
                </div>
              )
            })}
            {stats && stats.recent.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No tickets scanned in the last 7 days.</div>
            )}
          </div>
        </div>
  )
}
