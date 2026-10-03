'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { dhakaDate } from '@/lib/scan'
import { dhakaClock } from '@/lib/trips'
import { busLabel, type CompanyTrip, type FleetOption } from './types'

const EMPTY = { fleetId: '', from: '', to: '', date: '', departureTime: '', arrivalTime: '', price: '', boardingPoint: '', boardingMapUrl: '' }

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-1.5 px-1 text-[12px] font-bold text-[#e7e2da]">
        {label}
        {note && <span className="text-[11px] font-semibold text-[#8e9a9d]">{note}</span>}
      </span>
      {children}
    </label>
  )
}

/**
 * A trip for one of the company's own buses. It goes on sale on bushubbd.com straight away.
 * Today's date is filled in, a time already gone today is refused, and the boarding point last
 * used by this bus from this city is copied in.
 */
export default function TripForm({
  fleet,
  cities,
  trips,
  onCreated,
}: {
  fleet: FleetOption[]
  cities: string[]
  trips: CompanyTrip[]
  onCreated: (tripId: string) => void
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY, date: dhakaDate() }))
  const [busy, setBusy] = useState(false)
  const today = dhakaDate()
  const clock = dhakaClock()
  const pastTime = form.date === today && form.departureTime !== '' && form.departureTime <= clock

  /** Bring along the boarding point this bus last used from this city. */
  const pick = (change: Partial<typeof EMPTY>) => {
    const next = { ...form, ...change }
    if (!form.boardingPoint) {
      const last = [...trips].reverse().find((t) => t.fleetId === next.fleetId && t.from === next.from && t.boardingPoint)
      if (last) next.boardingPoint = last.boardingPoint
    }
    setForm(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pastTime) {
      toast.error(`That time has already passed today (it is ${clock} now)`)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/company/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Could not add the trip')
        return
      }
      toast.success('Trip added. It is on sale on bushubbd.com now.')
      setForm({ ...form, date: dhakaDate(), departureTime: '', arrivalTime: '' })
      onCreated(String(data.bus._id))
    } finally {
      setBusy(false)
    }
  }

  if (fleet.length === 0) {
    return (
      <p className="glass-lite p-4 text-[13px] text-[#c4cdcf]">
        Your company has no buses on BusHub yet. Ask the BusHub team to add your buses first.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="glass-lite grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Bus">
        <select required value={form.fleetId} onChange={(e) => pick({ fleetId: e.target.value })} className="input-dark" aria-label="Bus">
          <option value="">Choose bus…</option>
          {fleet.map((f) => (
            <option key={f._id} value={f._id}>
              {busLabel(f)} · {f.totalSeats} seats
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fare per seat (৳)">
        <input required type="number" min={1} placeholder="e.g. 750" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-dark" aria-label="Fare" />
      </Field>
      <Field label="From">
        <select required value={form.from} onChange={(e) => pick({ from: e.target.value })} className="input-dark" aria-label="From">
          <option value="">Choose city…</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="To">
        <select required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="input-dark" aria-label="To">
          <option value="">Choose city…</option>
          {cities.filter((c) => c !== form.from).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Travel date" note={form.date === today ? '(today)' : undefined}>
        <input required type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-dark" aria-label="Travel date" />
      </Field>
      <Field label="Departure time" note={form.date === today ? `(after ${clock})` : undefined}>
        <input required type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className="input-dark" aria-label="Departure time" />
      </Field>
      <Field label="Arrival time" note="(optional)">
        <input type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} className="input-dark" aria-label="Arrival time" />
      </Field>
      <Field label="Boarding point" note="(where the bus leaves from)">
        <input required maxLength={120} placeholder="e.g. Dampara counter, Chattogram" value={form.boardingPoint} onChange={(e) => setForm({ ...form, boardingPoint: e.target.value })} className="input-dark" aria-label="Boarding point" />
      </Field>
      <Field label="Google Maps link" note="(optional)">
        <input type="url" inputMode="url" placeholder="Paste the share link" value={form.boardingMapUrl} onChange={(e) => setForm({ ...form, boardingMapUrl: e.target.value })} className="input-dark" aria-label="Google Maps link" />
      </Field>
      {pastTime && (
        <p className="rounded-xl bg-[#f87171]/[0.1] px-3 py-2 text-[12px] font-semibold text-[#fca5a5] sm:col-span-2">
          It is {clock} now in Bangladesh. Pick a later time, or another day.
        </p>
      )}
      <button type="submit" disabled={busy || pastTime} className="glass-btn h-12 self-end disabled:opacity-50 sm:col-span-2">
        {busy ? 'Adding…' : 'Add trip'}
      </button>
    </form>
  )
}
