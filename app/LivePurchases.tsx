'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { routePath } from '@/lib/routes'
import type { Activity } from './api/activity/route'

/** Pages where the popups show. Never during booking or payment, or on the ticket. */
const SHOW_ON = [/^\/$/, /^\/search/, /^\/routes/, /^\/about/]

const FIRST_DELAY = 6_000
const VISIBLE_FOR = 6_000
const GAP = 18_000
const REFRESH_EVERY = 60_000
const MAX_PER_VISIT = 6
const DISMISS_KEY = 'bushub-live-dismissed'

function ago(at: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000))
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

const keyOf = (a: Activity) => `${a.at}|${a.from}|${a.to}`

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A small card in the corner that says a ticket was just bought on a route: real, paid tickets
 * only, with no name or number. One at a time, a few per visit, and gone for the rest of the
 * visit once closed.
 */
export default function LivePurchases() {
  const pathname = usePathname() || '/'
  const enabled = SHOW_ON.some((re) => re.test(pathname))
  const [current, setCurrent] = useState<Activity | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const queue = useRef<Activity[]>([])
  const seen = useRef(new Set<string>())
  const shown = useRef(0)

  useEffect(() => setDismissed(readDismissed()), [])

  // Load recent tickets, and pick up new ones while the page is open.
  useEffect(() => {
    if (!enabled || dismissed) return
    let stop = false
    const load = () =>
      fetch('/api/activity')
        .then((r) => r.json())
        .then((d: { activity?: Activity[] }) => {
          if (stop) return
          for (const a of d.activity || []) {
            if (seen.current.has(keyOf(a))) continue
            seen.current.add(keyOf(a))
            queue.current.push(a)
          }
          queue.current.sort((a, b) => b.at.localeCompare(a.at))
        })
        .catch(() => undefined)
    load()
    const id = setInterval(load, REFRESH_EVERY)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [enabled, dismissed])

  // Show them one at a time.
  useEffect(() => {
    if (!enabled || dismissed) return
    let timer: ReturnType<typeof setTimeout>
    const next = (delay: number) => {
      timer = setTimeout(() => {
        const item = queue.current.shift()
        if (!item || shown.current >= MAX_PER_VISIT) {
          if (shown.current < MAX_PER_VISIT) next(GAP)
          return
        }
        shown.current += 1
        setCurrent(item)
        setVisible(true)
        timer = setTimeout(() => {
          setVisible(false)
          next(GAP)
        }, VISIBLE_FOR)
      }, delay)
    }
    next(FIRST_DELAY)
    return () => clearTimeout(timer)
  }, [enabled, dismissed])

  if (!enabled || dismissed || !current) return null

  const close = () => {
    setVisible(false)
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private browsing: it just comes back on the next page.
    }
  }

  // The search page has its own bar along the bottom; sit above it there.
  const bottom = pathname.startsWith('/search') ? 'bottom-[92px]' : 'bottom-3 sm:bottom-5'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`no-print fixed inset-x-3 z-50 transition-all duration-500 motion-reduce:transition-none sm:left-5 sm:right-auto sm:w-[340px] ${bottom} ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0 motion-reduce:translate-y-0'
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-[#0b2545]/10 bg-[#f3f6fa]/95 py-3 pl-3 pr-2 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <a href={routePath(current.from, current.to)} className="flex min-w-0 grow items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#feb249] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
              <path d="M14 5v12" strokeDasharray="2 2" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3fd0c9] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#06304a] bg-[#3fd0c9]" />
            </span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[11.5px] font-semibold text-[#44526b]">Someone booked a ticket</span>
            <span className="truncate text-[14.5px] font-bold text-[#0b2545]">
              {current.from} → {current.to}
            </span>
            <span className="text-[11.5px] text-[#4f5d75]">
              {current.seats} seat{current.seats === 1 ? '' : 's'} · {ago(current.at, Date.now())}
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={close}
          aria-label="Hide these messages"
          className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full text-[#5a677d] transition hover:bg-[#0b2545]/[0.05] hover:text-[#0b2545]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
