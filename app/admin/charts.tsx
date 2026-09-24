'use client'

import { useState } from 'react'

/**
 * Chart marks for the admin dashboard. Colours were checked with the dataviz palette
 * validator against the glass surface (#151b1d): both sit in the dark lightness band, clear
 * 3:1 contrast and stay apart under colour-blind simulation.
 */
export const ACCENT = '#e8601a'
export const TEAL = '#12a594'
const MUTED_LINE = '#56666a'
const GRID = 'rgba(255,255,255,0.07)'

/** Taka with Bangladeshi lakh grouping: ৳1,23,456. */
export function taka(value: number): string {
  return `৳${Math.round(value).toLocaleString('en-IN')}`
}

export function Tooltip({ value, label, style }: { value: string; label: string; style?: React.CSSProperties }) {
  return (
    <div
      role="status"
      style={style}
      className="pointer-events-none absolute z-20 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-xl border border-white/10 bg-[#0f1416]/95 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <span className="text-[12.5px] font-bold text-white">{value}</span>
      <span className="text-[10.5px] text-[#8e9a9d]">{label}</span>
    </div>
  )
}

/**
 * Trend line for a stat tile: the earlier week in a quiet gray, the current week in the
 * accent, so the line reads as "this week against last". Hover snaps to the nearest day.
 */
export function Sparkline({
  values,
  labels,
  format,
  currentFrom,
  color = ACCENT,
}: {
  values: number[]
  labels: string[]
  format: (v: number) => string
  /** Index where the current period starts. */
  currentFrom: number
  color?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 120
  const H = 40
  const PAD = 5
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)] as const)
  const path = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')
  const last = pts[pts.length - 1]
  const areaPath = `${path(currentFrom, pts.length - 1)} L${last[0].toFixed(1)},${H - PAD} L${pts[currentFrom][0].toFixed(1)},${H - PAD} Z`

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(values.length - 1, Math.round((x - PAD) / (step || 1)))))
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[46px] w-full touch-none overflow-visible"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Last ${values.length} days: ${values.map((v, i) => `${labels[i]} ${format(v)}`).join(', ')}`}
      >
        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={path(0, currentFrom)} fill="none" stroke={MUTED_LINE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={path(currentFrom, pts.length - 1)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={H} stroke="rgba(255,255,255,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Current value: an 8px accent dot with a surface ring so it stays legible on the line.
          Drawn in HTML because the stretched SVG would squash a circle into an oval. */}
      <span
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#151b1d]"
        style={{
          left: `${((hover !== null ? pts[hover] : last)[0] / W) * 100}%`,
          top: `${((hover !== null ? pts[hover] : last)[1] / H) * 100}%`,
          background: color,
        }}
      />
      {hover !== null && (
        <Tooltip
          value={format(values[hover])}
          label={labels[hover]}
          style={{ left: `${(pts[hover][0] / W) * 100}%`, bottom: '100%', marginBottom: 6 }}
        />
      )}
    </div>
  )
}

/** Clean round axis maximum, so ticks read 0 / 5 / 10 rather than 0 / 3.7 / 7.4. */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= value) return m * pow
  }
  return 10 * pow
}

/**
 * One series of columns from a single baseline: at most 24px wide with a 4px rounded top,
 * hairline grid, the latest and the peak labelled, every column hoverable.
 */
export function ColumnChart({
  data,
  format,
  highlightLast = true,
  height = 150,
}: {
  data: { key: string; label: string; full: string; value: number }[]
  format: (v: number) => string
  highlightLast?: boolean
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [top, top / 2, 0]
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  const PLOT = height

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between pb-6 text-right text-[10.5px] tabular-nums text-[#6e7b7e]" style={{ height: PLOT + 24 }}>
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
            {format(t)}
          </span>
        ))}
      </div>
      <div className="relative grow">
        <div className="absolute inset-x-0 top-0" style={{ height: PLOT }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className="absolute inset-x-0 h-px"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%`, background: i === ticks.length - 1 ? 'rgba(255,255,255,0.14)' : GRID }}
            />
          ))}
        </div>
        <div className="relative flex items-end" style={{ height: PLOT }}>
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(4, (d.value / top) * PLOT) : 0
            const isLast = highlightLast && i === data.length - 1
            const labelled = (i === peak && d.value > 0) || (isLast && d.value > 0)
            return (
              <button
                type="button"
                key={d.key}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.full}: ${format(d.value)}`}
                className="relative flex h-full min-w-0 grow basis-0 flex-col items-center justify-end outline-none"
              >
                {/* The label floats above the bar; laid out in flow it would squash the bar
                    and draw the busiest day shorter than its value. */}
                {labelled && (
                  <span className="pointer-events-none absolute text-[10.5px] font-bold text-[#c4cdcf]" style={{ bottom: h + 4 }}>
                    {format(d.value)}
                  </span>
                )}
                <span
                  className="block w-[70%] max-w-[24px] shrink-0 rounded-t transition-[filter]"
                  style={{
                    height: h,
                    background: isLast ? ACCENT : `${ACCENT}8c`,
                    filter: hover === i ? 'brightness(1.35)' : undefined,
                  }}
                />
                {hover === i && <Tooltip value={format(d.value)} label={d.full} style={{ left: '50%', bottom: h + 22 }} />}
              </button>
            )
          })}
        </div>
        <div className="flex h-6 items-end">
          {data.map((d, i) => (
            <span
              key={d.key}
              className={`min-w-0 grow basis-0 truncate text-center text-[10.5px] ${
                i === data.length - 1 ? 'font-bold text-[#c4cdcf]' : 'text-[#6e7b7e]'
              } ${i % 2 === 1 && i !== data.length - 1 ? 'max-sm:invisible' : ''}`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Horizontal bars, one series, largest first; every value written at the bar's end. */
export function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number; sub?: string }[]
  format: (v: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <div key={r.label} className="group flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-semibold text-[#e8eef0]">{r.label}</span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">{format(r.value)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="block h-2.5 rounded-r transition-[filter] group-hover:brightness-125"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: ACCENT }}
            />
          </div>
          {r.sub && <span className="text-[11px] text-[#78868a]">{r.sub}</span>}
        </div>
      ))}
    </div>
  )
}

/** A single ratio against its whole: teal fill on a lighter step of the same teal. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-3 w-full overflow-hidden rounded-full"
        style={{ background: `${TEAL}33` }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: TEAL }} />
      </div>
      <div className="flex justify-between text-[11.5px] text-[#8e9a9d]">
        <span>{label}</span>
        <span className="font-semibold text-[#c4cdcf]">{pct}%</span>
      </div>
    </div>
  )
}
