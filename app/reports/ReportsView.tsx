'use client'

import { useEffect, useMemo, useState } from 'react'
import DateRangePicker, { rangeLabel } from '../DateRangePicker'
import { ACCENT, BarList, ColumnChart, Meter, SplitBar, TrendChart, taka } from '../admin/charts'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import { downloadSheet, sheetDate } from '@/lib/sheet'
import type { Kpi, PaymentKey, Report } from '@/lib/reports'

const count = (v: number) => Math.round(v).toLocaleString('en-IN')
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const shortDay = (d: string) => `${Number(d.slice(8, 10))} ${SHORT[Number(d.slice(5, 7)) - 1]}`
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`

/** Payment colours: checked with the dataviz validator on the light card (all checks pass). */
const PAYMENT: Record<PaymentKey, { label: string; color: string }> = {
  bkash: { label: 'bKash', color: '#d0105e' },
  nagad: { label: 'Nagad', color: '#e8601a' },
  card: { label: 'Card', color: '#6a4bc4' },
  cash: { label: 'Cash', color: '#008f86' },
  unknown: { label: 'Not recorded', color: '#a3a7ae' },
}
const COUNTER_COLOR = '#008f86'

type Preset = '7' | '30' | '90' | 'month' | 'custom'

function rangeFor(preset: Preset, today: string): [string, string] {
  if (preset === 'month') return [`${today.slice(0, 8)}01`, today]
  const days = Number(preset) || 30
  return [shift(today, -(days - 1)), today]
}

/** "+31%", "−0.4 pts", or "–" when there is nothing to compare with. */
function changeText(k: Kpi): string {
  if (k.pct === null) return '–'
  const sign = k.pct > 0 ? '+' : k.pct < 0 ? '−' : ''
  return `${sign}${Math.abs(k.pct)}${k.points ? ' pts' : '%'}`
}

function Change({ k, upIsGood = true }: { k: Kpi; upIsGood?: boolean }) {
  if (k.pct === null) {
    return <span className="rounded-full bg-[#111111]/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#3f3f3f]">{k.current > 0 ? 'New' : 'No change'}</span>
  }
  const up = k.pct > 0
  const flat = k.pct === 0
  const good = flat ? null : up === upIsGood
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        good === null ? 'bg-[#111111]/[0.06] text-[#3f3f3f]' : good ? 'bg-[#0a8a84]/[0.12] text-[#0a6f6a]' : 'bg-[#c13b3b]/[0.1] text-[#b42318]'
      }`}
    >
      {!flat && (
        <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 ${up ? '' : 'rotate-180'}`} fill="currentColor" aria-hidden>
          <path d="M6 2 10.5 8h-9z" />
        </svg>
      )}
      {flat ? 'Same' : k.points ? `${Math.abs(k.pct)} pts` : `${Math.abs(k.pct)}%`}
    </span>
  )
}

function Tile({ label, value, k, prev, upIsGood, accent }: { label: string; value: string; k: Kpi; prev: string; upIsGood?: boolean; accent?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-[20px] p-3.5 sm:p-4 ${accent ? 'bg-gradient-to-br from-[#feb249] to-[#f2661d] text-[#1a0d03]' : 'glass-lite'}`}>
      <span className="truncate text-[12px] font-bold opacity-80">{label}</span>
      <span className="display truncate text-[22px] font-extrabold leading-none sm:text-[26px]">{value}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Change k={k} upIsGood={upIsGood} />
        <span className="truncate text-[11px] opacity-75">before: {prev}</span>
      </div>
    </div>
  )
}

function Card({ title, note, children, action }: { title: string; note?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="glass-lite flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="display text-[15.5px] font-bold">{title}</h3>
          {note && <span className="text-[11.5px] text-[#4a4a4a]">{note}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Reports for any date range, compared with the same number of days before it. The admin sees
 * all of BusHub (companies, BusHub earnings); a company manager sees their own buses, with
 * counter sales counted in.
 */
export default function ReportsView({ scope }: { scope: 'admin' | 'company' }) {
  const today = dhakaDate()
  const [preset, setPreset] = useState<Preset>('30')
  const [[from, to], setRange] = useState<[string, string]>(rangeFor('30', today))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [measure, setMeasure] = useState<'money' | 'seats'>('money')

  useEffect(() => {
    let cancelled = false
    setError('')
    fetch(`/api/${scope === 'admin' ? 'admin' : 'company'}/reports?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (cancelled) return
        if (ok) setReport(d)
        else setError(d.error || 'Could not load the report')
      })
      .catch(() => !cancelled && setError('Could not load the report. Check the connection.'))
    return () => {
      cancelled = true
    }
  }, [scope, from, to])

  const choose = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRange(rangeFor(p, today))
  }

  const r = report
  const isAdmin = scope === 'admin'
  const trend = useMemo(() => {
    if (!r) return null
    return {
      current: r.trend.map((d) => (measure === 'money' ? d.money : d.seats)),
      previous: r.trend.map((d) => (measure === 'money' ? d.prevMoney : d.prevSeats)),
      labels: r.trend.map((d) => ({ short: shortDay(d.date), full: formatTripDate(d.date) })),
      prevLabels: r.trend.map((d) => formatTripDate(d.prevDate)),
    }
  }, [r, measure])

  if (error) return <p className="glass-lite mt-4 p-6 text-center text-[13px] text-[#b42318]">{error}</p>
  if (!r || !trend) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Making the report…</div>

  const k = r.kpis
  const prevText = rangeLabel(r.range.prevFrom, r.range.prevTo)
  const nothing = k.tickets.current === 0 && k.seats.current === 0 && k.refunds.current === 0
  const pctText = (v: number) => `${Math.round(v * 10) / 10}%`

  const excel = () =>
    downloadSheet(`BusHub-report-${sheetDate(r.range.from)}-to-${sheetDate(r.range.to)}`, [
      {
        name: 'Summary',
        title: isAdmin ? 'BusHub report' : 'Sales report',
        notes: [`${rangeLabel(r.range.from, r.range.to)} · compared with ${prevText}`],
        columns: [{ header: 'Measure' }, { header: 'This period' }, { header: 'Period before' }, { header: 'Change' }],
        rows: [
          [isAdmin ? 'Tickets sold online' : 'Online tickets', k.tickets.current, k.tickets.previous, changeText(k.tickets)],
          ['Seats sold', k.seats.current, k.seats.previous, changeText(k.seats)],
          ['Ticket sales (৳)', k.sales.current, k.sales.previous, changeText(k.sales)],
          [isAdmin ? 'BusHub earnings (৳)' : 'You keep (৳)', k.earnings.current, k.earnings.previous, changeText(k.earnings)],
          ['Average online ticket (৳)', k.avgTicket.current, k.avgTicket.previous, changeText(k.avgTicket)],
          ['Refunds', k.refunds.current, k.refunds.previous, changeText(k.refunds)],
          ['Refund rate %', k.refundRate.current, k.refundRate.previous, changeText(k.refundRate)],
          ['Seat fill %', k.fill.current, k.fill.previous, changeText(k.fill)],
        ],
      },
      {
        name: 'By day',
        title: 'Sales by day',
        notes: [`${rangeLabel(r.range.from, r.range.to)}`],
        columns: [
          { header: 'Date', kind: 'date' },
          { header: 'Seats', kind: 'int', total: true },
          { header: 'Money', kind: 'money', total: true },
          { header: 'Day before period', kind: 'date' },
          { header: 'Seats then', kind: 'int', total: true },
          { header: 'Money then', kind: 'money', total: true },
        ],
        rows: r.trend.map((d) => [d.date, d.seats, d.money, d.prevDate, d.prevSeats, d.prevMoney]),
      },
      {
        name: 'Routes',
        title: 'Top routes',
        notes: [`${rangeLabel(r.range.from, r.range.to)}`],
        columns: [{ header: 'From' }, { header: 'To' }, { header: 'Seats', kind: 'int', total: true }, { header: 'Money', kind: 'money', total: true }, { header: 'Seat fill %' }],
        rows: r.routes.map((x) => [x.from, x.to, x.seats, x.money, x.fill]),
      },
      ...(isAdmin
        ? [
            {
              name: 'Companies',
              title: 'Bus companies',
              notes: [`${rangeLabel(r.range.from, r.range.to)}`],
              columns: [
                { header: 'Company' },
                { header: 'Tickets', kind: 'int' as const, total: true },
                { header: 'Seats', kind: 'int' as const, total: true },
                { header: 'Sales', kind: 'money' as const, total: true },
                { header: 'BusHub earnings', kind: 'money' as const, total: true },
                { header: 'Seat fill %' },
                { header: 'Refund %' },
                { header: 'Rating' },
              ],
              rows: r.companies.map((c) => [c.name, c.tickets, c.seats, c.money, c.commission, c.fill, c.refundRate, c.rating ? `${c.rating} (${c.ratings})` : '']),
            },
          ]
        : [
            {
              name: 'Buses',
              title: 'Buses',
              notes: [`Trips travelling ${rangeLabel(r.range.from, r.range.to)}`],
              columns: [
                { header: 'Bus' },
                { header: 'Trips', kind: 'int' as const, total: true },
                { header: 'Seats sold', kind: 'int' as const, total: true },
                { header: 'Seats', kind: 'int' as const, total: true },
                { header: 'Seat fill %' },
                { header: 'Money', kind: 'money' as const, total: true },
              ],
              rows: r.buses.map((b) => [b.name, b.trips, b.seats, b.capacity, b.fill, b.money]),
            },
          ]),
    ])

  return (
    <div className="mt-2 flex flex-col gap-4">
      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['7', '7 days'],
            ['30', '30 days'],
            ['90', '90 days'],
            ['month', 'This month'],
            ['custom', 'Custom'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => choose(id)} aria-pressed={preset === id} className={`chip ${preset === id ? 'chip-active' : ''}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={excel} className="glass-btn glass-btn-plain ml-auto h-10 px-4 text-[13px]">
          Excel
        </button>
      </div>
      {preset === 'custom' && (
        <div className="max-w-sm">
          <DateRangePicker from={from} to={to} onChange={(f, t) => f && t && setRange([f, t])} label="Report dates" allText="Choose dates" />
        </div>
      )}
      <p className="-mt-1 text-[12.5px] text-[#3f3f3f]">
        <b className="text-[#111111]">{rangeLabel(r.range.from, r.range.to)}</b> · compared with {prevText}
      </p>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile accent label="Ticket sales" value={taka(k.sales.current)} k={k.sales} prev={taka(k.sales.previous)} />
        <Tile label={isAdmin ? 'BusHub earnings' : 'You keep'} value={taka(k.earnings.current)} k={k.earnings} prev={taka(k.earnings.previous)} />
        <Tile label="Seats sold" value={count(k.seats.current)} k={k.seats} prev={count(k.seats.previous)} />
        <Tile label="Seat fill" value={pctText(k.fill.current)} k={k.fill} prev={pctText(k.fill.previous)} />
        <Tile label={isAdmin ? 'Tickets sold' : 'Online tickets'} value={count(k.tickets.current)} k={k.tickets} prev={count(k.tickets.previous)} />
        <Tile label="Average ticket" value={taka(k.avgTicket.current)} k={k.avgTicket} prev={taka(k.avgTicket.previous)} />
        <Tile label="Refunds" value={count(k.refunds.current)} k={k.refunds} prev={count(k.refunds.previous)} upIsGood={false} />
        <Tile label="Refund rate" value={pctText(k.refundRate.current)} k={k.refundRate} prev={pctText(k.refundRate.previous)} upIsGood={false} />
      </div>

      {nothing && <p className="glass-lite p-4 text-center text-[13px] text-[#3f3f3f]">No sales in this period. Try a longer period.</p>}

      {/* Trend */}
      <Card
        title={measure === 'money' ? 'Sales by day' : 'Seats by day'}
        note={`Each day against the same day of the period before${isAdmin ? ' · online tickets' : ' · online and counter'}`}
        action={
          <div className="flex shrink-0 gap-1 rounded-full bg-[#111111]/[0.05] p-1 text-[12px] font-bold" role="group" aria-label="Show">
            {(['money', 'seats'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMeasure(m)} aria-pressed={measure === m} className={`h-7 rounded-full px-3 ${measure === m ? 'bg-white shadow-sm' : 'text-[#4a4a4a]'}`}>
                {m === 'money' ? 'Money' : 'Seats'}
              </button>
            ))}
          </div>
        }
      >
        <TrendChart current={trend.current} previous={trend.previous} labels={trend.labels} prevLabels={trend.prevLabels} format={measure === 'money' ? taka : count} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top routes" note="By seats sold · seat fill of trips travelling in the period">
          {r.routes.length === 0 ? (
            <p className="text-[12.5px] text-[#4a4a4a]">No routes sold in this period.</p>
          ) : (
            <BarList
              rows={r.routes.map((x) => ({ label: `${x.from} → ${x.to}`, value: x.seats, sub: `${taka(x.money)}${x.fill !== null ? ` · ${x.fill}% full` : ''}` }))}
              format={(v) => `${count(v)} seats`}
            />
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="How people paid" note={isAdmin ? 'Online tickets' : 'Online and counter tickets'}>
            <SplitBar parts={r.payment.map((p) => ({ key: p.method, label: PAYMENT[p.method].label, value: p.money, color: PAYMENT[p.method].color, note: `${count(p.count)} tickets` }))} format={taka} />
          </Card>
          <Card title="Online vs counter" note="Seats sold in the period">
            <SplitBar
              parts={[
                { key: 'online', label: 'BusHub online', value: r.channel.online.seats, color: ACCENT, note: taka(r.channel.online.money) },
                { key: 'counter', label: 'Counter', value: r.channel.counter.seats, color: COUNTER_COLOR, note: taka(r.channel.counter.money) },
              ]}
              format={(v) => `${count(v)} seats`}
            />
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={isAdmin ? 'Seat fill by company' : 'Seat fill by bus'} note="Trips travelling in the period">
          {(isAdmin ? r.companies : r.buses).length === 0 ? (
            <p className="text-[12.5px] text-[#4a4a4a]">No trips in this period.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {isAdmin
                ? r.companies.slice(0, 8).map((c) => <Meter key={c.id} value={c.fill ?? 0} max={100} label={`${c.name}${c.fill === null ? ' · no trips' : ''}`} />)
                : r.buses.map((b) => <Meter key={b.name} value={b.seats} max={b.capacity || 1} label={`${b.name} · ${b.trips} trip${b.trips === 1 ? '' : 's'} · ${count(b.seats)}/${count(b.capacity)} seats`} />)}
            </div>
          )}
        </Card>
        <Card title="Emptiest trips coming up" note="Next 7 days · sell these first">
          {r.lowFill.length === 0 ? (
            <p className="text-[12.5px] text-[#4a4a4a]">No trips in the next 7 days.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {r.lowFill.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-bold">
                      {t.from} → {t.to} · {t.departureTime}
                    </span>
                    <span className="truncate text-[11.5px] text-[#4a4a4a]">
                      {formatTripDate(t.date)} · {t.busName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums">
                    {t.sold}/{t.total}
                    <span className="block text-[10.5px] font-semibold text-[#4a4a4a]">{Math.round((t.sold / t.total) * 100)}% full</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Busiest hours" note="When tickets are bought · Dhaka time, 0–23 hour clock">
          <ColumnChart data={r.hours.map((v, h) => ({ key: String(h), label: h % 6 === 0 ? String(h) : '', full: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, value: v }))} format={count} highlightLast={false} height={130} />
        </Card>
        <Card title="Busiest days" note="Day of the week tickets are bought">
          <ColumnChart data={r.weekdays.map((v, d) => ({ key: String(d), label: WEEK[d], full: WEEK[d], value: v }))} format={count} highlightLast={false} height={130} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How early people book" note="Online tickets: days between buying and travelling">
          <BarList rows={r.leadTime.map((l) => ({ label: l.label, value: l.tickets }))} format={(v) => `${count(v)} tickets`} />
        </Card>
        <Card title={isAdmin ? 'Passenger ratings' : 'Your passenger rating'} note="All reviews so far">
          <div className="flex items-baseline gap-2">
            <span className="display text-[34px] font-extrabold leading-none">{r.rating.avg ?? '–'}</span>
            <span className="text-[18px] text-[#e8601a]" aria-hidden>
              ★
            </span>
            <span className="text-[12.5px] text-[#4a4a4a]">
              {count(r.rating.count)} review{r.rating.count === 1 ? '' : 's'}
            </span>
          </div>
          {isAdmin && r.companies.some((c) => c.ratings > 0) && (
            <BarList rows={r.companies.filter((c) => c.ratings > 0).map((c) => ({ label: c.name, value: c.rating || 0, sub: `${c.ratings} reviews` }))} format={(v) => `${v} ★`} />
          )}
        </Card>
      </div>

      {isAdmin && r.companies.length > 0 && (
        <Card title="Bus companies" note="Tickets sold online in the period · fill of their trips travelling in it">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[#4a4a4a]">
                  <th className="px-1 py-2">Company</th>
                  <th className="px-1 py-2 text-right">Tickets</th>
                  <th className="px-1 py-2 text-right">Sales</th>
                  <th className="px-1 py-2 text-right">BusHub earns</th>
                  <th className="px-1 py-2 text-right">Seat fill</th>
                  <th className="px-1 py-2 text-right">Refunds</th>
                  <th className="px-1 py-2 text-right">Rating</th>
                </tr>
              </thead>
              <tbody>
                {r.companies.map((c) => (
                  <tr key={c.id} className="border-t border-[#111111]/[0.08]">
                    <td className="px-1 py-2 font-bold">{c.name}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{count(c.tickets)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{taka(c.money)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{taka(c.commission)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{c.fill === null ? '–' : `${c.fill}%`}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{c.refundRate === null ? '–' : `${c.refundRate}%`}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{c.rating ? `${c.rating} ★ (${c.ratings})` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
