'use client'

import { formatTripDate } from '@/lib/dates'
import type { DayCount, ScanResult, ScannerCount } from '@/lib/scan'

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

function dhakaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** Boardings by day and the latest scans; the manager also sees which scanner did each. */
export default function ScanHistory({ stats, showScanner = false }: { stats: ScanStats | null; showScanner?: boolean }) {
  return (
    <div className="mt-5 flex flex-col gap-4">
          {showScanner && stats?.byScanner && (
            <div className="card-2 overflow-hidden">
              <div className="border-b border-[#1a2123] px-4 py-3">
                <span className="label-xs">Each scanner · passengers boarded</span>
              </div>
              {stats.byScanner.map((row, i) => (
                <div key={`${row.name}-${i}`} className="flex items-center gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0">
                  <div className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-[#5eead4]">{row.name}</span>
                    <span className="text-[11.5px] text-[#78868a]">
                      7 days: {row.week.passengers} passenger{row.week.passengers === 1 ? '' : 's'} · {row.week.tickets} ticket{row.week.tickets === 1 ? '' : 's'}
                      {row.week.rejected > 0 ? ` · ${row.week.rejected} rejected` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="display text-[20px] font-bold leading-none text-[#34d399]">{row.today.passengers}</span>
                    <span className="text-[10.5px] text-[#8e9a9d]">today</span>
                  </div>
                </div>
              ))}
              {stats.byScanner.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#8e9a9d]">No scans in the last 7 days.</div>
              )}
            </div>
          )}

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
                    {showScanner && item.scannerName && <span className="text-[11px] text-[#6e7b7e]">Scanned by {item.scannerName}</span>}
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
  )
}
