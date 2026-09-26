'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { MAX_POPULAR_ROUTES, Places } from '@/lib/places'

async function change(body: Record<string, string>) {
  const res = await fetch('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, error: (data?.error as string) || '' }
}

/**
 * The cities customers (and the Add a trip form) can pick from, and the popular routes on the
 * home page. Cities are typed once here; everywhere else they are chosen from a dropdown.
 */
export default function PlacesPanel({ places, onChanged }: { places: Places; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [city, setCity] = useState('')
  const [route, setRoute] = useState({ from: '', to: '' })
  const [busy, setBusy] = useState(false)

  const run = async (body: Record<string, string>, done: string) => {
    setBusy(true)
    const { ok, error } = await change(body)
    setBusy(false)
    if (!ok) {
      toast.error(error || 'Could not save')
      return false
    }
    toast.success(done)
    onChanged()
    return true
  }

  return (
    <section className="glass flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
              <circle cx="12" cy="10" r="2.3" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="display text-[15.5px] font-bold">Cities &amp; routes</span>
            <span className="text-[11.5px] text-[#78868a]">
              {places.cities.length} cities · {places.popularRoutes.length} popular routes on the home page
            </span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 text-[#8e9a9d] transition ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-white/[0.06] px-5 pb-5 pt-4">
          <div className="flex flex-col gap-3">
            <span className="label-xs">Cities</span>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (await run({ action: 'addCity', city }, `${city.trim()} added`)) setCity('')
              }}
              className="flex gap-2"
            >
              <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="New city, e.g. Kuakata" aria-label="New city" className="input-dark grow" />
              <button type="submit" disabled={busy} className="glass-btn h-12 shrink-0 px-5 text-[13.5px]">
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {places.cities.map((c) => (
                <span key={c} className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] pl-3.5 pr-1.5 text-[13px] font-semibold">
                  {c}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirm(`Remove ${c}? Customers won't be able to pick it.`) && run({ action: 'removeCity', city: c }, `${c} removed`)}
                    aria-label={`Remove ${c}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#8e9a9d] hover:bg-white/10 hover:text-[#fca5a5]"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-3 w-3">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4">
            <span className="label-xs">
              Popular routes on the home page ({places.popularRoutes.length}/{MAX_POPULAR_ROUTES})
            </span>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (await run({ action: 'addRoute', ...route }, `${route.from} → ${route.to} added`)) setRoute({ from: '', to: '' })
              }}
              className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <select required value={route.from} onChange={(e) => setRoute({ ...route, from: e.target.value })} className="input-dark" aria-label="Route from">
                <option value="">From</option>
                {places.cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select required value={route.to} onChange={(e) => setRoute({ ...route, to: e.target.value })} className="input-dark" aria-label="Route to">
                <option value="">To</option>
                {places.cities.filter((c) => c !== route.from).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" disabled={busy} className="glass-btn col-span-2 h-12 px-5 text-[13.5px] sm:col-span-1">
                Add route
              </button>
            </form>
            {places.popularRoutes.length === 0 && <p className="text-[12.5px] text-[#8e9a9d]">No popular routes. The home page hides the section.</p>}
            <ol className="flex flex-col gap-2">
              {places.popularRoutes.map((r, i) => (
                <li key={`${r.from}-${r.to}`} className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 py-2 pl-4 pr-2">
                  <span className="w-5 text-[12px] font-bold tabular-nums text-[#78868a]">{i + 1}</span>
                  <span className="grow text-[13.5px] font-semibold">
                    {r.from} → {r.to}
                  </span>
                  {i > 0 && (
                    <button type="button" disabled={busy} onClick={() => run({ action: 'moveRoute', ...r }, 'Moved up')} aria-label={`Move ${r.from} to ${r.to} up`} className="icon-btn h-8 w-8">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="m6 14 6-6 6 6" />
                      </svg>
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => run({ action: 'removeRoute', ...r }, 'Route removed')} aria-label={`Remove ${r.from} to ${r.to}`} className="icon-btn h-8 w-8 text-[#fca5a5]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-3.5 w-3.5">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
