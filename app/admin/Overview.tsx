'use client'

import { formatTripDate } from '@/lib/dates'
import { tripDeparted } from '@/lib/trips'
import { seatsLeft } from '@/lib/seats'
import type { Delta, SalesSummary } from '@/lib/stats'
import BookingList from './BookingList'
import { BarList, ColumnChart, Meter, Sparkline, TEAL, taka } from './charts'
import type { Booking, Bus } from './types'
import Plate from '../Plate'

const count = (v: number) => Math.round(v).toLocaleString('en-IN')

function DeltaChip({ delta, upIsGood = true }: { delta: Delta; upIsGood?: boolean }) {
  if (delta.pct === null) {
    return (
      <span className="rounded-full bg-white/40 px-2 py-0.5 text-[11px] font-semibold">
        {delta.current > 0 ? 'New this week' : 'None yet'}
      </span>
    )
  }
  const up = delta.pct > 0
  const flat = delta.pct === 0
  const good = flat ? null : up === upIsGood
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        good === null ? 'bg-white/40' : good ? 'bg-white/85 text-[#0a6f72]' : 'bg-white/85 text-[#c13b3b]'
      }`}
    >
      <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 ${flat ? 'hidden' : up ? '' : 'rotate-180'}`} fill="currentColor" aria-hidden>
        <path d="M6 2 10.5 8h-9z" />
      </svg>
      {flat ? 'Same as' : `${Math.abs(delta.pct)}%`}
      <span className="max-sm:hidden">vs last week</span>
    </span>
  )
}

/** Button colours from the palette, each with a line colour that shows on it. */
const TONES = {
  navy: { card: 'bg-[#002447] text-[#fbeceb] shadow-[0_12px_28px_rgba(0,36,71,0.3)]', line: '#53d3d1' },
  aqua: { card: 'bg-[#53d3d1] text-[#002447] shadow-[0_12px_28px_rgba(83,211,209,0.4)]', line: '#002447' },
  orange: { card: 'bg-gradient-to-br from-[#f2661d] to-[#feb249] text-[#1a0d03] shadow-[0_12px_28px_rgba(242,102,29,0.35)]', line: '#002447' },
  pink: { card: 'border border-[#002447]/10 bg-[#fbeceb] text-[#002447] shadow-[0_12px_28px_rgba(0,36,71,0.12)]', line: '#f2661d' },
}

/** A number on the dashboard: a button that opens the page with its details. */
function StatTile({
  label,
  value,
  note,
  delta,
  upIsGood,
  series,
  labels,
  format,
  tone,
  icon,
  onOpen,
}: {
  label: string
  value: string
  note?: string
  delta: Delta
  upIsGood?: boolean
  series: number[]
  labels: string[]
  format: (v: number) => string
  tone: keyof typeof TONES
  icon: React.ReactNode
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={`relative flex min-w-0 cursor-pointer flex-col gap-2.5 overflow-hidden rounded-[22px] p-3.5 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#f2661d] sm:gap-3 sm:p-5 ${TONES[tone].card}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/25 sm:h-9 sm:w-9">{icon}</span>
        <span className="truncate text-[12px] font-bold opacity-90 sm:text-[12.5px]">{label}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="display truncate text-[21px] font-bold leading-none sm:text-[30px]">{value}</span>
        {note && <span className="truncate text-[11px] opacity-80 sm:text-[11.5px]">{note}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DeltaChip delta={delta} upIsGood={upIsGood} />
      </div>
      {/* Touching the line shows that day's number; it does not open the page. */}
      <div onClick={(e) => e.stopPropagation()}>
        <Sparkline values={series} labels={labels} format={format} currentFrom={Math.floor(series.length / 2)} color={TONES[tone].line} />
      </div>
      <span className="text-[11px] font-bold opacity-90">Details ›</span>
    </div>
  )
}

const icons = {
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
      <path d="M14 5v12" strokeDasharray="2 2.5" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </svg>
  ),
  earn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M4 17l5-5 4 4 7-7" />
      <path d="M15 9h5v5" />
    </svg>
  ),
  refund: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
}

function Card({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex flex-col">
          <h2 className="display text-[15.5px] font-bold">{title}</h2>
          {subtitle && <span className="text-[11.5px] text-[#555555]">{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function Overview({
  stats,
  bookings,
  buses,
  onRefund,
  onSeeAllBookings,
  onOpen,
}: {
  stats: SalesSummary | null
  bookings: Booking[]
  buses: Bus[]
  onRefund: (id: string) => void
  onSeeAllBookings: () => void
  /** Opens a section from a number: Bookings (optionally only refunded ones) or Money. */
  onOpen: (section: 'bookings' | 'costs', filter?: 'refunded') => void
}) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-[208px] animate-pulse opacity-60" />
        ))}
      </div>
    )
  }

  const { totals, series, deltas, byCompany, boardingToday, channels } = stats
  const labels = series.map((d) => formatTripDate(d.date))
  const upcoming = buses
    .filter((b) => b.status === 'active' && !tripDeparted(b.date, b.departureTime))
    .sort((a, b) => (a.date + a.departureTime).localeCompare(b.date + b.departureTime))
    .slice(0, 5)
  const channelTotal = channels.web + channels.whatsapp

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Tickets sold"
          value={count(totals.tickets)}
          note={`${count(totals.seats)} seats`}
          delta={deltas.tickets}
          series={series.map((d) => d.tickets)}
          labels={labels}
          format={(v) => `${count(v)} tickets`}
          tone="navy"
          onOpen={() => onOpen('bookings')}
          icon={icons.ticket}
        />
        <StatTile
          label="Revenue"
          value={taka(totals.revenue)}
          note="Collected from passengers"
          delta={deltas.revenue}
          series={series.map((d) => d.revenue)}
          labels={labels}
          format={taka}
          tone="aqua"
          onOpen={() => onOpen('costs')}
          icon={icons.money}
        />
        <StatTile
          label="BusHub earnings"
          value={taka(totals.commission)}
          note="Your commission"
          delta={deltas.commission}
          series={series.map((d) => d.commission)}
          labels={labels}
          format={taka}
          tone="orange"
          onOpen={() => onOpen('costs')}
          icon={icons.earn}
        />
        <StatTile
          label="Refunds"
          value={count(totals.refunds)}
          note={`${taka(totals.refundedAmount)} returned`}
          delta={deltas.refunds}
          upIsGood={false}
          series={series.map((d) => d.refunds)}
          labels={labels}
          format={(v) => `${count(v)} refunds`}
          tone="pink"
          onOpen={() => onOpen('bookings', 'refunded')}
          icon={icons.refund}
        />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="Tickets sold per day" subtitle="Last 14 days, Dhaka time">
          <div className="px-4 pb-4 pt-1 sm:px-5">
            <ColumnChart
              data={series.map((d) => ({
                key: d.date,
                label: String(Number(d.date.slice(8))),
                full: formatTripDate(d.date),
                value: d.tickets,
              }))}
              format={count}
              height={210}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4 sm:gap-5">
          <Card title="Boarding today" subtitle="Passengers scanned onto today's buses">
            <div className="flex flex-col gap-3 px-5 pb-5">
              {boardingToday.seats === 0 ? (
                <p className="text-[13px] text-[#4a4a4a]">No tickets sold for today&apos;s trips yet.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="display text-[30px] font-bold leading-none">{count(boardingToday.boarded)}</span>
                    <span className="text-[13px] text-[#4a4a4a]">of {count(boardingToday.seats)} passengers</span>
                  </div>
                  <Meter value={boardingToday.boarded} max={boardingToday.seats} label="Boarded" />
                </>
              )}
            </div>
          </Card>

          <Card title="Where tickets are sold">
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              {[
                { label: 'Website', value: channels.web, key: '#93c5fd' },
                { label: 'WhatsApp', value: channels.whatsapp, key: '#5fdcd5' },
              ].map((c) => (
                <div key={c.label} className="flex flex-col gap-1 rounded-2xl border border-[#111111]/10 bg-[#111111]/[0.05] p-3.5">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#3f3f3f]">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.key }} />
                    {c.label}
                  </span>
                  <span className="display text-[22px] font-bold leading-tight">{count(c.value)}</span>
                  <span className="text-[11px] text-[#5e5e5e]">
                    {channelTotal ? Math.round((c.value / channelTotal) * 100) : 0}% of tickets
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Recent bookings"
        subtitle="Newest first"
        action={
          <button type="button" onClick={onSeeAllBookings} className="rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3.5 py-1.5 text-[12px] font-bold text-[#0b7f8c] transition hover:bg-[#111111]/[0.05]">
            See all
          </button>
        }
      >
        <BookingList bookings={bookings.slice(0, 6)} onRefund={onRefund} empty="No bookings yet. They appear here the moment someone books." />
      </Card>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card title="What you owe bus companies" subtitle="Their share of every paid ticket">
          <div className="flex flex-col gap-4 px-5 pb-5">
            {byCompany.length === 0 ? (
              <p className="text-[13px] text-[#4a4a4a]">Nothing owed yet.</p>
            ) : (
              <BarList
                rows={byCompany.map((c) => ({ label: c.name, value: c.owed, sub: `${count(c.tickets)} tickets` }))}
                format={taka}
              />
            )}
            <div className="flex items-center justify-between border-t border-[#111111]/10 pt-3.5">
              <span className="text-[12.5px] font-semibold text-[#3f3f3f]">Total to pay out</span>
              <span className="display text-[19px] font-bold text-[#0b7f8c]">{taka(totals.owed)}</span>
            </div>
          </div>
        </Card>

        <Card title="Next departures" subtitle="Seats sold on each bus">
          <ul className="flex flex-col px-5 pb-4">
            {upcoming.length === 0 && <li className="pb-2 text-[13px] text-[#4a4a4a]">No upcoming buses. Add one in Buses.</li>}
            {upcoming.map((b) => {
              const taken = b.totalSeats - seatsLeft(b)
              return (
                <li key={b._id} className="flex items-center gap-3 border-t border-[#111111]/10 py-3 first:border-t-0 first:pt-0">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-[#111111]/10 bg-[#111111]/[0.05] leading-none">
                    <span className="text-[13px] font-bold">{Number(b.date.slice(8))}</span>
                    <span className="text-[9.5px] font-semibold uppercase text-[#4a4a4a]">{formatTripDate(b.date).split(' ')[2]}</span>
                  </span>
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <span className="truncate text-[13px] font-semibold">
                      {b.busName} · {b.departureTime}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#555555]">
                      <span className="truncate">
                        {b.from} → {b.to} · {b.companyName}
                      </span>
                      <Plate plate={b.plateNumber} />
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: `${TEAL}33` }}>
                      <span className="block h-full rounded-full" style={{ width: `${(taken / Math.max(1, b.totalSeats)) * 100}%`, background: TEAL }} />
                    </span>
                  </div>
                  <span className="shrink-0 text-right text-[12px] tabular-nums text-[#2b2b2b]">
                    <span className="block text-[14px] font-bold text-[#111111]">{taken}</span>/{b.totalSeats}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
