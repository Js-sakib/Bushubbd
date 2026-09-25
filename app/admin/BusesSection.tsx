'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { seatsLeft } from '@/lib/seats'
import SeatManager from '../SeatManager'
import { taka } from './charts'
import type { Booking, Bus, CompanyRow, FleetBus } from './types'

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']
const EMPTY_FLEET_FORM = { name: '', companyId: '', busType: 'AC', totalSeats: '40', logoUrl: '' }
const EMPTY_TRIP_FORM = {
  fleetId: '', from: '', to: '', date: '', departureTime: '', arrivalTime: '', price: '', commissionRate: '10',
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, error: (data?.error as string) || '' }
}

function PanelHeader({ open, onToggle, title, hint, icon }: { open: boolean; onToggle: () => void; title: string; hint: string; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center justify-between gap-3 px-5 py-4 text-left">
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
          {icon}
        </span>
        <span className="flex flex-col">
          <span className="display text-[15.5px] font-bold">{title}</span>
          <span className="text-[11.5px] text-[#78868a]">{hint}</span>
        </span>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 text-[#8e9a9d] transition ${open ? 'rotate-180' : ''}`}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}

const PLUS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-4 w-4">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const BUS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect x="3" y="4" width="18" height="12.5" rx="3" />
    <path d="M3 11h18" />
    <circle cx="7.5" cy="19" r="1.6" />
    <circle cx="16.5" cy="19" r="1.6" />
  </svg>
)

/**
 * Buses are listed once (name, company, type, seats) and every trip picks one from a dropdown,
 * so a ticket's bus and company name always match the company that scans it.
 */
export default function BusesSection({
  buses,
  bookings,
  companies,
  fleet,
  onChanged,
}: {
  buses: Bus[]
  bookings: Booking[]
  companies: CompanyRow[]
  fleet: FleetBus[]
  onChanged: () => void
}) {
  const [fleetForm, setFleetForm] = useState(EMPTY_FLEET_FORM)
  const [tripForm, setTripForm] = useState(EMPTY_TRIP_FORM)
  const [fleetOpen, setFleetOpen] = useState(false)
  const [tripOpen, setTripOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [manageSeatsBusId, setManageSeatsBusId] = useState<string | null>(null)
  const approved = companies.filter((c) => c.status === 'approved')
  const chosen = fleet.find((f) => f._id === tripForm.fleetId)

  const handleAddFleetBus = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, error } = await send('/api/fleet', 'POST', { ...fleetForm, totalSeats: Number(fleetForm.totalSeats) })
    setBusy(false)
    if (!ok) {
      toast.error(error || 'Could not add the bus')
      return
    }
    toast.success(`${fleetForm.name.trim()} is on your bus list`)
    setFleetForm({ ...EMPTY_FLEET_FORM, companyId: fleetForm.companyId })
    onChanged()
  }

  const handleRemoveFleetBus = async (bus: FleetBus) => {
    if (!confirm(`Remove ${bus.name} from your bus list?`)) return
    const { ok, error } = await send(`/api/fleet/${bus._id}`, 'DELETE')
    if (!ok) {
      toast.error(error || 'Could not remove the bus')
      return
    }
    toast.success('Removed')
    onChanged()
  }

  const handleLogo = async (bus: FleetBus) => {
    const next = prompt(`Logo link for ${bus.name} (leave empty to remove)`, bus.logoUrl || '')
    if (next === null) return
    const { ok, error } = await send(`/api/fleet/${bus._id}`, 'PATCH', { logoUrl: next })
    if (!ok) {
      toast.error(error || 'Could not save the logo')
      return
    }
    toast.success('Logo saved. Trips and tickets show it too.')
    onChanged()
  }

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, error } = await send('/api/buses', 'POST', {
      ...tripForm,
      price: Number(tripForm.price),
      commissionRate: Number(tripForm.commissionRate),
    })
    setBusy(false)
    if (!ok) {
      toast.error(error || 'Failed to add the trip')
      return
    }
    toast.success('Trip added')
    // Keep the bus and route: the next trip is usually the same bus on another day.
    setTripForm({ ...tripForm, date: '', departureTime: '', arrivalTime: '' })
    onChanged()
  }

  const handleLinkFleet = async (bus: Bus, fleetId: string) => {
    if (!fleetId) return
    const target = fleet.find((f) => f._id === fleetId)
    if (!target || !confirm(`Link this trip to ${target.name} (${target.companyName})? Its tickets will show that name.`)) return
    const { ok, error } = await send(`/api/buses/${bus._id}`, 'PATCH', { fleetId })
    if (!ok) {
      toast.error(error || 'Could not link the trip')
      return
    }
    toast.success(`Linked. ${target.companyName} can now scan these tickets.`)
    onChanged()
  }

  const managed = manageSeatsBusId ? buses.find((b) => b._id === manageSeatsBusId) : null

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="glass flex flex-col">
        <PanelHeader
          open={fleetOpen}
          onToggle={() => setFleetOpen((v) => !v)}
          title="Your bus list"
          hint={`${fleet.length} bus${fleet.length === 1 ? '' : 'es'} · add each bus name once`}
          icon={BUS}
        />
        {fleetOpen && (
          <div className="flex flex-col border-t border-white/[0.06]">
            {approved.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-[#c4cdcf]">First add the bus company under Companies. Then list its buses here.</p>
            ) : (
              <form onSubmit={handleAddFleetBus} className="grid gap-3 px-5 pb-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <input required placeholder="Bus name, e.g. Green Line Scania 1" value={fleetForm.name} onChange={(e) => setFleetForm({ ...fleetForm, name: e.target.value })} className="input-dark sm:col-span-2" aria-label="Bus name" />
                <select required value={fleetForm.companyId} onChange={(e) => setFleetForm({ ...fleetForm, companyId: e.target.value })} className="input-dark sm:col-span-2" aria-label="Bus company">
                  <option value="" disabled>
                    Choose bus company…
                  </option>
                  {approved.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select value={fleetForm.busType} onChange={(e) => setFleetForm({ ...fleetForm, busType: e.target.value })} className="input-dark" aria-label="Bus type">
                  <option>AC</option>
                  <option>Non-AC</option>
                  <option>Sleeper</option>
                </select>
                <input required type="number" min={1} max={60} placeholder="Seats" value={fleetForm.totalSeats} onChange={(e) => setFleetForm({ ...fleetForm, totalSeats: e.target.value })} className="input-dark" aria-label="Total seats" />
                <input placeholder="Logo link (optional)" value={fleetForm.logoUrl} onChange={(e) => setFleetForm({ ...fleetForm, logoUrl: e.target.value })} className="input-dark sm:col-span-2" aria-label="Logo link" />
                <button type="submit" disabled={busy} className="glass-btn h-12 sm:col-span-2 lg:col-span-4">
                  Add to bus list
                </button>
              </form>
            )}
            {fleet.length > 0 && (
              <ul className="flex flex-col">
                {fleet.map((f) => (
                  <li key={f._id} className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-3">
                    <div className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="truncate text-[14px] font-semibold">{f.name}</span>
                      <span className="truncate text-[11.5px] text-[#9ba7aa]">
                        {f.companyName} · {f.busType} · {f.totalSeats} seats · {f.tripCount} trip{f.tripCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <button type="button" onClick={() => handleLogo(f)} className="h-8 shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11.5px] font-bold text-[#c4cdcf]">
                      {f.logoUrl ? 'Logo ✓' : 'Logo'}
                    </button>
                    {f.tripCount === 0 && (
                      <button type="button" onClick={() => handleRemoveFleetBus(f)} className="h-8 shrink-0 rounded-full bg-[#f87171]/[0.1] px-3 text-[11.5px] font-bold text-[#fca5a5]">
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="glass flex flex-col">
        <PanelHeader open={tripOpen} onToggle={() => setTripOpen((v) => !v)} title="Add a trip" hint="Pick the bus from your list, then the route and time" icon={PLUS} />
        {tripOpen && (
          <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
            {fleet.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[13px] text-[#c4cdcf]">Your bus list is empty. Add the bus there first, then pick it here.</p>
                <button type="button" onClick={() => setFleetOpen(true)} className="glass-btn glass-btn-plain h-10 px-4 text-[13px]">
                  Open bus list
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddTrip} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <select required value={tripForm.fleetId} onChange={(e) => setTripForm({ ...tripForm, fleetId: e.target.value })} className="input-dark sm:col-span-2 lg:col-span-3" aria-label="Bus">
                  <option value="" disabled>
                    Choose bus…
                  </option>
                  {fleet.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} · {f.companyName}
                    </option>
                  ))}
                </select>
                {chosen && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-2.5 text-[12px] text-[#c4cdcf] sm:col-span-2 lg:col-span-3">
                    <span>
                      Company: <b className="text-[#f6f4ef]">{chosen.companyName}</b>
                    </span>
                    <span>
                      Type: <b className="text-[#f6f4ef]">{chosen.busType}</b>
                    </span>
                    <span>
                      Seats: <b className="text-[#f6f4ef]">{chosen.totalSeats}</b>
                    </span>
                  </div>
                )}
                <select required value={tripForm.from} onChange={(e) => setTripForm({ ...tripForm, from: e.target.value })} className="input-dark" aria-label="From">
                  <option value="">From</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select required value={tripForm.to} onChange={(e) => setTripForm({ ...tripForm, to: e.target.value })} className="input-dark" aria-label="To">
                  <option value="">To</option>
                  {CITIES.filter((c) => c !== tripForm.from).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input required type="date" value={tripForm.date} onChange={(e) => setTripForm({ ...tripForm, date: e.target.value })} className="input-dark" aria-label="Travel date" />
                <input required type="time" value={tripForm.departureTime} onChange={(e) => setTripForm({ ...tripForm, departureTime: e.target.value })} className="input-dark" aria-label="Departure time" />
                <input type="time" value={tripForm.arrivalTime} onChange={(e) => setTripForm({ ...tripForm, arrivalTime: e.target.value })} className="input-dark" aria-label="Arrival time" />
                <input required type="number" min={1} placeholder="Fare (৳)" value={tripForm.price} onChange={(e) => setTripForm({ ...tripForm, price: e.target.value })} className="input-dark" aria-label="Fare" />
                <input required type="number" min={0} max={50} placeholder="Commission %" value={tripForm.commissionRate} onChange={(e) => setTripForm({ ...tripForm, commissionRate: e.target.value })} className="input-dark" aria-label="Commission percent" />
                <button type="submit" disabled={busy} className="glass-btn h-12 sm:col-span-2 lg:col-span-2">
                  Add trip
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="glass flex flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 className="display text-[15.5px] font-bold">All trips</h2>
          <span className="text-[11.5px] text-[#78868a]">{buses.length} listed</span>
        </div>
        {buses.length === 0 && <p className="px-5 pb-8 pt-4 text-center text-sm text-[#8e9a9d]">No trips yet. Add one above.</p>}
        <ul className="flex flex-col">
          {buses.map((b) => {
            const linked = Boolean(b.fleetId)
            const free = seatsLeft(b)
            return (
              <li key={b._id} className={`flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3.5 ${manageSeatsBusId === b._id ? 'bg-white/[0.03]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[14px] font-semibold">{b.busName}</span>
                    <span className="truncate text-[12px] text-[#9ba7aa]">
                      {b.from} → {b.to} · {formatTripDate(b.date)} · {b.departureTime}
                    </span>
                    {linked ? (
                      <span className="truncate text-[11.5px] text-[#6e7b7e]">{b.companyName}</span>
                    ) : (
                      <span className="text-[11.5px] font-bold text-[#f5a524]">{b.companyName} · old trip, link it to a bus below</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[14px] font-bold tabular-nums">{taka(b.price)}</span>
                    <span className={`text-[11.5px] tabular-nums ${free === 0 ? 'font-bold text-[#fca5a5]' : 'text-[#9ba7aa]'}`}>
                      {free === 0 ? 'Sold out' : `${free}/${b.totalSeats} free`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!linked && (
                    <select
                      value=""
                      onChange={(e) => handleLinkFleet(b, e.target.value)}
                      aria-label={`Link ${b.busName} to a bus from your list`}
                      className="input-dark h-9 min-w-[170px] grow py-0 text-[12.5px] sm:grow-0"
                    >
                      <option value="">Link to a bus from your list…</option>
                      {fleet.map((f) => (
                        <option key={f._id} value={f._id}>
                          {f.name} · {f.companyName}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setManageSeatsBusId(manageSeatsBusId === b._id ? null : b._id)}
                    className="h-9 rounded-full border border-white/10 bg-white/[0.05] px-3.5 text-[12px] font-bold text-[#f5a524] transition hover:bg-white/[0.09]"
                  >
                    {manageSeatsBusId === b._id ? 'Close seats' : 'Manage seats'}
                  </button>
                </div>
                {managed && managed._id === b._id && <SeatManager bus={managed} bookings={bookings} onChange={onChanged} />}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
