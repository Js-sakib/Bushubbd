'use client'

import { useEffect, useRef, useState } from 'react'
import { dhakaDate } from '@/lib/scan'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const parts = (date: string) => date.split('-').map(Number) as [number, number, number]
const shiftDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** "27 Sep – 3 Oct 2026", "3 Oct 2026", or the given empty text. */
export function rangeLabel(from: string, to: string, empty = 'All dates'): string {
  if (!from && !to) return empty
  const one = (d: string, year: boolean) => {
    const [y, m, day] = parts(d)
    return `${day} ${SHORT[m - 1]}${year ? ` ${y}` : ''}`
  }
  if (!from || !to) return from ? `From ${one(from, true)}` : `Until ${one(to, true)}`
  if (from === to) return one(from, true)
  return `${one(from, from.slice(0, 4) !== to.slice(0, 4))} – ${one(to, true)}`
}

function Month({
  year,
  month,
  from,
  to,
  hover,
  today,
  onPick,
  onHover,
}: {
  year: number
  month: number
  from: string
  to: string
  hover: string
  today: string
  onPick: (d: string) => void
  onHover: (d: string) => void
}) {
  const start = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const days = lastDay(year, month)
  // While picking the end, the range follows the pointer.
  const end = to || (from && hover ? hover : '')
  const [lo, hi] = from && end && end < from ? [end, from] : [from, end]
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[var(--c-muted)]">
        {WEEK.map((w) => (
          <span key={w} className="py-1.5">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: start }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = iso(year, month, i + 1)
          const isEnd = d === lo || d === hi
          const inside = lo && hi && d > lo && d < hi
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              aria-label={d}
              aria-pressed={Boolean(isEnd || inside)}
              className={`relative mx-auto flex h-9 w-full items-center justify-center text-[13px] font-semibold transition ${
                isEnd
                  ? 'rounded-[10px] bg-[#feb249] text-[#1a0d03]'
                  : inside
                    ? 'bg-[#feb249]/[0.16] text-[var(--c-range)]'
                    : 'rounded-[10px] text-[var(--c-ink)] hover:bg-[var(--c-hover)]'
              } ${d === today && !isEnd ? 'ring-1 ring-inset ring-[var(--c-faint)] rounded-[10px]' : ''}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * A date button that opens a calendar: tap a day, then another, for everything between them
 * (27 Sep → 3 Oct); tap the same day twice (or double-tap) for that one day. Quick picks for
 * today, the last 7 days, this month and last month; "All dates" clears it.
 */
export default function DateRangePicker({
  from,
  to,
  onChange,
  label = 'Dates',
  allText = 'All dates',
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  label?: string
  allText?: string
}) {
  const today = dhakaDate()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('') // first tap, waiting for the second
  const [hover, setHover] = useState('')
  const [alignRight, setAlignRight] = useState(false)
  // The month shown on a phone, and on the right on a computer (the month before is on the left).
  const [view, setView] = useState(() => {
    const [y, m] = parts(to || from || today)
    return { y, m: m - 1 }
  })
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const [y, m] = parts(to || from || today)
      setView({ y, m: m - 1 })
      setStart('')
      // Open towards the side with room, so the calendar never runs off the screen.
      const rect = box.current?.getBoundingClientRect()
      const width = window.innerWidth >= 768 ? 640 : Math.max(rect?.width || 0, 300)
      setAlignRight(Boolean(rect && rect.left + width > window.innerWidth - 8 && rect.right - width >= 8))
    }
    setOpen(!open)
  }
  const apply = (a: string, b: string) => {
    onChange(a <= b ? a : b, a <= b ? b : a)
    setStart('')
    setOpen(false)
  }
  const pick = (d: string) => {
    if (!start) return setStart(d)
    apply(start, d) // the same day twice is that one day
  }
  const move = (n: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }))
  const prev = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 }

  const [ty, tm] = parts(today)
  const quick: [string, () => void][] = [
    ['Today', () => apply(today, today)],
    ['Yesterday', () => apply(shiftDays(today, -1), shiftDays(today, -1))],
    ['Last 7 days', () => apply(shiftDays(today, -6), today)],
    ['This month', () => apply(iso(ty, tm - 1, 1), iso(ty, tm - 1, lastDay(ty, tm - 1)))],
    [
      'Last month',
      () => {
        const y = tm === 1 ? ty - 1 : ty
        const m = tm === 1 ? 11 : tm - 2
        apply(iso(y, m, 1), iso(y, m, lastDay(y, m)))
      },
    ],
  ]
  const shownFrom = start || from
  const shownTo = start ? '' : to

  return (
    <div ref={box} className="relative flex min-w-0 flex-col gap-1">
      <span className="label-xs">{label}</span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`input-dark flex min-w-0 grow items-center gap-2.5 text-left ${open ? '!border-[#cc8b65]' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-[#53d3d1]">
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
          <span className={`truncate text-[14px] ${from || to ? '' : 'font-medium text-[var(--c-muted)]'}`}>{rangeLabel(from, to, allText)}</span>
        </button>
        {(from || to) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            aria-label="Clear dates"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] border border-[var(--c-line)] bg-[var(--c-field)] text-[var(--c-muted)] hover:text-[var(--c-ink)]"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className={`absolute top-full z-50 ${alignRight ? 'right-0' : 'left-0'} mt-2 w-full min-w-[300px] rounded-2xl border border-[var(--c-line)] bg-[var(--c-pop)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] md:w-[640px]`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-[var(--c-ink)] hover:bg-[var(--c-hover)]">
              ‹
            </button>
            <div className="grid grow grid-cols-1 text-center text-[15px] font-bold md:grid-cols-2">
              <span className="hidden md:block">
                {MONTHS[prev.m]} {prev.y}
              </span>
              <span>
                {MONTHS[view.m]} {view.y}
              </span>
            </div>
            <button type="button" onClick={() => move(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-[var(--c-ink)] hover:bg-[var(--c-hover)]">
              ›
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:divide-x md:divide-[var(--c-line)]" onMouseLeave={() => setHover('')}>
            <div className="hidden md:block">
              <Month year={prev.y} month={prev.m} from={shownFrom} to={shownTo} hover={start ? hover : ''} today={today} onPick={pick} onHover={setHover} />
            </div>
            <div className="md:pl-4">
              <Month year={view.y} month={view.m} from={shownFrom} to={shownTo} hover={start ? hover : ''} today={today} onPick={pick} onHover={setHover} />
            </div>
          </div>
          <p className="mt-2 min-h-[16px] text-center text-[11.5px] text-[var(--c-muted)]">
            {start ? `From ${rangeLabel(start, start)} — now tap the last day (or the same day again for one day)` : 'Tap the first day, then the last day. Double-tap a day for that day only.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--c-line)] pt-2.5">
            {quick.map(([name, run]) => (
              <button key={name} type="button" onClick={run} className="h-8 rounded-full border border-[var(--c-line)] px-3 text-[12px] font-bold text-[var(--c-ink)] hover:border-[#cc8b65]/60">
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onChange('', '')
                setOpen(false)
              }}
              className="h-8 rounded-full border border-[var(--c-line)] px-3 text-[12px] font-bold text-[var(--c-muted)] hover:text-[var(--c-ink)]"
            >
              {allText}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
