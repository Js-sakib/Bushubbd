'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { seatsLeft } from '@/lib/seats'
import SeatManager from '../SeatManager'
import { taka } from './charts'
import type { Places } from '@/lib/places'
import PlacesPanel from './PlacesPanel'
import type { Booking, Bus, CompanyRow, FleetBus } from './types'
import { dhakaDate } from '@/lib/scan'
import { dhakaClock, tripDeparted } from '@/lib/trips'

const EMPTY_FLEET_FORM = { name: '', companyId: '', busType: 'AC', totalSeats: '40', logoUrl: '', commissionRate: '10' }
const EMPTY_TRIP_FORM = {
  fleetId: '', from: '', to: '', date: '', departureTime: '', arrivalTime: '', price: '', boardingPoint: '', boardingMapUrl: '',
}
const DEFAULT_RATE = 10
const HISTORY_PAGE = 20

/** The current time, refreshed every half minute, so trips move to history as they leave. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface TripSales {
  tickets: number
  seats: number
  boarded: number
  sales: number
  commission: number
  payout: number
}

/** What a trip sold: paid, confirmed tickets only. Unpaid holds and refunds are not sales. */
function salesByTrip(bookings: Booking[]): Map<string, TripSales> {
  const map = new Map<string, TripSales>()
  for (const b of bookings) {
    if (b.status !== 'confirmed' || b.paymentStatus !== 'paid') continue
    let t = map.get(b.busId)
    if (!t) {
      t = { tickets: 0, seats: 0, boarded: 0, sales: 0, commission: 0, payout: 0 }
      map.set(b.busId, t)
    }
    t.tickets += 1
    t.seats += b.seats.length
    if (b.checkedIn) t.boarded += b.seats.length
    t.sales += b.totalPrice || 0
    t.commission += b.commissionAmount || 0
    t.payout += b.companyPayout ?? b.totalPrice ?? 0
  }
  return map
}

/**
 * A date or time box with its name above it. On phones and tablets (Android and iPhone alike)
 * an empty time box is a plain dark box with nothing in it, so there it says what to tap until
 * a time is chosen. Computers show their own --:-- hint.
 */
function PickField({
  label,
  note,
  empty,
  invalid,
  children,
}: {
  label: string
  note?: string
  empty: boolean
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-1.5 px-1 text-[12px] font-bold text-[#e7e2da]">
        {label}
        {note && <span className="text-[11px] font-semibold text-[#8e9a9d]">{note}</span>}
      </span>
      <span className={`relative block rounded-[13px] ${empty ? 'pick-empty' : ''} ${invalid ? 'ring-1 ring-[#f87171]' : ''}`}>
        {children}
        {empty && (
          <span className="pointer-events-none absolute inset-y-0 left-[14px] hidden items-center text-[14px] font-medium text-[#6e7b7e] [@media(pointer:coarse)]:flex">
            Tap to choose
          </span>
        )}
      </span>
    </label>
  )
}

/** "22:14" → "10:14 PM", as the time boxes on phones show it. */
function clock12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "Departs 07:30 · Arrives 13:00", or just the departure when no arrival was set. */
function tripTimes(b: Bus) {
  return b.arrivalTime ? `Departs ${b.departureTime} · Arrives ${b.arrivalTime}` : `Departs ${b.departureTime}`
}

const byTime = (a: Bus, b: Bus) => (a.date + a.departureTime).localeCompare(b.date + b.departureTime)

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
  places,
  onChanged,
}: {
  buses: Bus[]
  bookings: Booking[]
  companies: CompanyRow[]
  fleet: FleetBus[]
  places: Places
  onChanged: () => void
}) {
  const CITIES = places.cities
  const now = useNow()
  const today = dhakaDate(now)
  const clock = dhakaClock(now)
  const [fleetForm, setFleetForm] = useState(EMPTY_FLEET_FORM)
  const [tripForm, setTripForm] = useState(() => ({ ...EMPTY_TRIP_FORM, date: dhakaDate() }))
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE)
  const [fleetOpen, setFleetOpen] = useState(false)
  const [tripOpen, setTripOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [manageSeatsBusId, setManageSeatsBusId] = useState<string | null>(null)
  const approved = companies.filter((c) => c.status === 'approved')
  const chosen = fleet.find((f) => f._id === tripForm.fleetId)
  // The boarding point last copied in by itself, so a typed one is never overwritten.
  const autoBoarding = useRef({ point: '', map: '' })

  /** The boarding point this bus (or, failing that, this company) last used from this city. */
  const lastBoarding = (fleetId: string, from: string) => {
    if (!fleetId || !from) return null
    const bus = fleet.find((f) => f._id === fleetId)
    const newestFirst = [...buses].filter((b) => b.from === from && b.boardingPoint).sort((a, b) => byTime(b, a))
    return (
      newestFirst.find((b) => b.fleetId === fleetId) ||
      (bus ? newestFirst.find((b) => b.companyId === bus.companyId) : undefined) ||
      null
    )
  }

  /** Change the bus or the From city, bringing along the boarding point used there before. */
  const pickBusOrCity = (change: { fleetId?: string; from?: string }) => {
    const next = { ...tripForm, ...change }
    const untouched =
      (!tripForm.boardingPoint || tripForm.boardingPoint === autoBoarding.current.point) &&
      (!tripForm.boardingMapUrl || tripForm.boardingMapUrl === autoBoarding.current.map)
    if (untouched) {
      const last = lastBoarding(next.fleetId, next.from)
      next.boardingPoint = last?.boardingPoint || ''
      next.boardingMapUrl = last?.boardingMapUrl || ''
      autoBoarding.current = { point: next.boardingPoint, map: next.boardingMapUrl }
    }
    setTripForm(next)
  }
  const boardingCopied = Boolean(tripForm.boardingPoint) && tripForm.boardingPoint === autoBoarding.current.point
  const rateOf = (f: FleetBus) => f.commissionRate ?? DEFAULT_RATE

  const upcoming = useMemo(() => buses.filter((b) => !tripDeparted(b.date, b.departureTime, now)).sort(byTime), [buses, now])
  const finished = useMemo(
    () => buses.filter((b) => tripDeparted(b.date, b.departureTime, now)).sort((a, b) => byTime(b, a)),
    [buses, now]
  )
  const sales = useMemo(() => salesByTrip(bookings), [bookings])
  const upcomingByFleet = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of upcoming) if (b.fleetId) map.set(b.fleetId, (map.get(b.fleetId) || 0) + 1)
    return map
  }, [upcoming])

  // On today's date, a departure time that has already gone can't be picked.
  const pastTime = tripForm.date === today && tripForm.departureTime !== '' && tripForm.departureTime <= clock
  const pastDate = tripForm.date !== '' && tripForm.date < today

  const handleAddFleetBus = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, error } = await send('/api/fleet', 'POST', {
      ...fleetForm,
      totalSeats: Number(fleetForm.totalSeats),
      commissionRate: Number(fleetForm.commissionRate),
    })
    setBusy(false)
    if (!ok) {
      toast.error(error || 'Could not add the bus')
      return
    }
    toast.success(`${fleetForm.name.trim()} is on your bus list`)
    setFleetForm({ ...EMPTY_FLEET_FORM, companyId: fleetForm.companyId, commissionRate: fleetForm.commissionRate })
    onChanged()
  }

  const handleRemoveFleetBus = async (bus: FleetBus) => {
    if (!confirm(`Delete ${bus.name} from your bus list?\n\nIts finished trips and sold tickets stay in your records.`)) return
    const { ok, error } = await send(`/api/fleet/${bus._id}`, 'DELETE')
    if (!ok) {
      toast.error(error || 'Could not delete the bus')
      return
    }
    toast.success(`${bus.name} deleted`)
    onChanged()
  }

  const handleCommission = async (bus: FleetBus) => {
    const next = prompt(
      `BusHub commission for ${bus.name}, in % (0 to 50).\n\nUpcoming trips use it for new tickets. Tickets already sold keep their old split.`,
      String(rateOf(bus))
    )
    if (next === null) return
    const rate = Number(next.replace('%', '').trim())
    if (next.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 50) {
      toast.error('Commission must be between 0 and 50%')
      return
    }
    const { ok, error } = await send(`/api/fleet/${bus._id}`, 'PATCH', { commissionRate: rate })
    if (!ok) {
      toast.error(error || 'Could not save the commission')
      return
    }
    toast.success(`${bus.name}: ${rate}% commission`)
    onChanged()
  }

  const handleDeleteTrip = async (bus: Bus, done: boolean) => {
    const what = `${bus.busName}, ${bus.from} → ${bus.to}, ${formatTripDate(bus.date)} ${bus.departureTime}`
    const message = done
      ? `Delete this finished trip from the history?\n\n${what}\n\nIts tickets stay in Bookings.`
      : `Delete this trip?\n\n${what}\n\nCustomers will no longer see it.`
    if (!confirm(message)) return
    const { ok, error } = await send(`/api/buses/${bus._id}`, 'DELETE')
    if (!ok) {
      toast.error(error || 'Could not delete the trip')
      return
    }
    if (manageSeatsBusId === bus._id) setManageSeatsBusId(null)
    toast.success('Trip deleted')
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
    if (pastDate) {
      toast.error('That date has already passed')
      return
    }
    if (pastTime) {
      toast.error(`That time has already passed today (it is ${clock12(clock)} now)`)
      return
    }
    setBusy(true)
    const { ok, error } = await send('/api/buses', 'POST', { ...tripForm, price: Number(tripForm.price) })
    setBusy(false)
    if (!ok) {
      toast.error(error || 'Failed to add the trip')
      return
    }
    toast.success('Trip added')
    // Keep the bus, route and fare: the next trip is usually the same bus at another time.
    setTripForm({ ...tripForm, date: dhakaDate(), departureTime: '', arrivalTime: '' })
    onChanged()
  }

  const handleBoarding = async (bus: Bus) => {
    const point = prompt(`Where does ${bus.busName} leave from? (counter or stand, e.g. Kalabagan counter, Dhaka)`, bus.boardingPoint || '')
    if (point === null) return
    const map = prompt('Google Maps link to it (optional, leave empty for none)', bus.boardingMapUrl || '')
    if (map === null) return
    const { ok, error } = await send(`/api/buses/${bus._id}`, 'PATCH', { boardingPoint: point, boardingMapUrl: map })
    if (!ok) {
      toast.error(error || 'Could not save the boarding point')
      return
    }
    toast.success('Saved. Tickets already sold show it too.')
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

  const managed = manageSeatsBusId ? upcoming.find((b) => b._id === manageSeatsBusId) : null
  const shownHistory = finished.slice(0, historyShown)
  const historyTotals = finished.reduce(
    (t, b) => {
      const s = sales.get(b._id)
      return s ? { seats: t.seats + s.seats, sales: t.sales + s.sales, commission: t.commission + s.commission, payout: t.payout + s.payout } : t
    },
    { seats: 0, sales: 0, commission: 0, payout: 0 }
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PlacesPanel places={places} onChanged={onChanged} />

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
                <label className="relative flex sm:col-span-2 lg:col-span-1">
                  <input required type="number" min={0} max={50} step="0.5" inputMode="decimal" placeholder="Commission" value={fleetForm.commissionRate} onChange={(e) => setFleetForm({ ...fleetForm, commissionRate: e.target.value })} className="input-dark w-full pr-28" aria-label="BusHub commission percent" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#8e9a9d]">% commission</span>
                </label>
                <input placeholder="Logo link (optional)" value={fleetForm.logoUrl} onChange={(e) => setFleetForm({ ...fleetForm, logoUrl: e.target.value })} className="input-dark sm:col-span-2 lg:col-span-3" aria-label="Logo link" />
                <p className="-mt-1 text-[11.5px] text-[#78868a] sm:col-span-2 lg:col-span-4">
                  Set BusHub&apos;s commission once here. Every trip of this bus uses it.
                </p>
                <button type="submit" disabled={busy} className="glass-btn h-12 sm:col-span-2 lg:col-span-4">
                  Add to bus list
                </button>
              </form>
            )}
            {fleet.length > 0 && (
              <ul className="flex flex-col">
                {fleet.map((f) => {
                  const next = upcomingByFleet.get(f._id) || 0
                  return (
                    <li key={f._id} className="flex flex-col gap-2.5 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="truncate text-[14px] font-semibold">{f.name}</span>
                        <span className="truncate text-[11.5px] text-[#9ba7aa]">
                          {f.companyName} · {f.busType} · {f.totalSeats} seats
                        </span>
                        <span className="text-[11.5px] text-[#78868a]">
                          <b className="text-[#f5a524]">{rateOf(f)}% commission</b> · {next} upcoming trip{next === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button type="button" onClick={() => handleCommission(f)} className="h-8 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11.5px] font-bold text-[#f5a524]">
                          Edit %
                        </button>
                        <button type="button" onClick={() => handleLogo(f)} className="h-8 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11.5px] font-bold text-[#c4cdcf]">
                          {f.logoUrl ? 'Logo ✓' : 'Logo'}
                        </button>
                        <button type="button" onClick={() => handleRemoveFleetBus(f)} className="h-8 rounded-full bg-[#f87171]/[0.1] px-3 text-[11.5px] font-bold text-[#fca5a5]">
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
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
                <select required value={tripForm.fleetId} onChange={(e) => pickBusOrCity({ fleetId: e.target.value })} className="input-dark sm:col-span-2 lg:col-span-3" aria-label="Bus">
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
                    <span>
                      Commission: <b className="text-[#f5a524]">{rateOf(chosen)}%</b>
                    </span>
                  </div>
                )}
                <PickField label="From" empty={false}>
                  <select required value={tripForm.from} onChange={(e) => pickBusOrCity({ from: e.target.value })} className="input-dark" aria-label="From">
                    <option value="">Choose city…</option>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </PickField>
                <PickField label="To" empty={false}>
                  <select required value={tripForm.to} onChange={(e) => setTripForm({ ...tripForm, to: e.target.value })} className="input-dark" aria-label="To">
                    <option value="">Choose city…</option>
                    {CITIES.filter((c) => c !== tripForm.from).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </PickField>
                <PickField label="Boarding point" note={boardingCopied ? '(copied from the last trip)' : '(where the bus leaves from)'} empty={false}>
                  <input
                    required
                    maxLength={120}
                    placeholder="e.g. Kalabagan counter, Dhaka"
                    value={tripForm.boardingPoint}
                    onChange={(e) => setTripForm({ ...tripForm, boardingPoint: e.target.value })}
                    className="input-dark"
                    aria-label="Boarding point"
                  />
                </PickField>
                <PickField label="Google Maps link" note="(optional)" empty={false}>
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="Paste the share link"
                    value={tripForm.boardingMapUrl}
                    onChange={(e) => setTripForm({ ...tripForm, boardingMapUrl: e.target.value })}
                    className="input-dark"
                    aria-label="Google Maps link"
                  />
                </PickField>
                <PickField label="Travel date" note={tripForm.date === today ? '(today)' : undefined} empty={!tripForm.date} invalid={pastDate}>
                  <input required type="date" min={today} value={tripForm.date} onChange={(e) => setTripForm({ ...tripForm, date: e.target.value })} className="input-dark" aria-label="Travel date" />
                </PickField>
                <PickField label="Departure time" note={tripForm.date === today ? `(after ${clock12(clock)})` : undefined} empty={!tripForm.departureTime} invalid={pastTime}>
                  <input required type="time" min={tripForm.date === today ? clock : undefined} value={tripForm.departureTime} onChange={(e) => setTripForm({ ...tripForm, departureTime: e.target.value })} className="input-dark" aria-label="Departure time" />
                </PickField>
                <PickField label="Arrival time" note="(optional)" empty={!tripForm.arrivalTime}>
                  <input type="time" value={tripForm.arrivalTime} onChange={(e) => setTripForm({ ...tripForm, arrivalTime: e.target.value })} className="input-dark" aria-label="Arrival time" />
                </PickField>
                {(pastTime || pastDate) && (
                  <p className="rounded-xl bg-[#f87171]/[0.1] px-3 py-2 text-[12px] font-semibold text-[#fca5a5] sm:col-span-2 lg:col-span-3">
                    {pastDate ? 'That date has already passed. Pick today or a later day.' : `It is ${clock12(clock)} now in Bangladesh. Pick a later time, or another day.`}
                  </p>
                )}
                <PickField label="Fare per seat (৳)" empty={false}>
                  <input required type="number" min={1} placeholder="e.g. 750" value={tripForm.price} onChange={(e) => setTripForm({ ...tripForm, price: e.target.value })} className="input-dark" aria-label="Fare" />
                </PickField>
                <button type="submit" disabled={busy || pastTime || pastDate} className="glass-btn h-12 self-end disabled:opacity-50 sm:col-span-1 lg:col-span-2">
                  Add trip
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="glass flex flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 className="display text-[15.5px] font-bold">Upcoming trips</h2>
          <span className="text-[11.5px] text-[#78868a]">{upcoming.length} on sale</span>
        </div>
        {upcoming.length === 0 && <p className="px-5 pb-8 pt-4 text-center text-sm text-[#8e9a9d]">No upcoming trips. Add one above.</p>}
        <ul className="flex flex-col">
          {upcoming.map((b) => {
            const linked = Boolean(b.fleetId)
            const free = seatsLeft(b)
            const sold = sales.get(b._id)
            return (
              <li key={b._id} className={`flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3.5 ${manageSeatsBusId === b._id ? 'bg-white/[0.03]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[14px] font-semibold">{b.busName}</span>
                    <span className="truncate text-[12px] text-[#9ba7aa]">
                      {b.from} → {b.to} · {formatTripDate(b.date)}
                    </span>
                    <span className="truncate text-[12px] font-semibold text-[#e7e2da]">{tripTimes(b)}</span>
                    {b.boardingPoint ? (
                      <span className="truncate text-[11.5px] text-[#9ba7aa]">📍 {b.boardingPoint}{b.boardingMapUrl ? ' · map ✓' : ''}</span>
                    ) : (
                      <span className="text-[11.5px] font-bold text-[#f5a524]">📍 No boarding point yet</span>
                    )}
                    {linked ? (
                      <span className="truncate text-[11.5px] text-[#6e7b7e]">
                        {b.companyName}
                        {b.commissionRate !== undefined ? ` · ${b.commissionRate}% commission` : ''}
                      </span>
                    ) : (
                      <span className="text-[11.5px] font-bold text-[#f5a524]">{b.companyName} · old trip, link it to a bus below</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[14px] font-bold tabular-nums">{taka(b.price)}</span>
                    <span className={`text-[11.5px] tabular-nums ${free === 0 ? 'font-bold text-[#fca5a5]' : 'text-[#9ba7aa]'}`}>
                      {free === 0 ? 'Sold out' : `${free}/${b.totalSeats} free`}
                    </span>
                    {sold && <span className="text-[11px] tabular-nums text-[#34d399]">{sold.seats} sold · {taka(sold.sales)}</span>}
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
                  <button
                    type="button"
                    onClick={() => handleBoarding(b)}
                    className="h-9 rounded-full border border-white/10 bg-white/[0.05] px-3.5 text-[12px] font-bold text-[#c4cdcf] transition hover:bg-white/[0.09]"
                  >
                    Boarding point
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrip(b, false)}
                    className="h-9 rounded-full bg-[#f87171]/[0.1] px-3.5 text-[12px] font-bold text-[#fca5a5] transition hover:bg-[#f87171]/[0.16]"
                  >
                    Delete
                  </button>
                </div>
                {managed && managed._id === b._id && <SeatManager bus={managed} bookings={bookings} onChange={onChanged} />}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="glass flex flex-col overflow-hidden">
        <PanelHeader
          open={historyOpen}
          onToggle={() => setHistoryOpen((v) => !v)}
          title="Finished trips"
          hint={
            finished.length === 0
              ? 'Trips move here by themselves once they leave'
              : `${finished.length} trip${finished.length === 1 ? '' : 's'} · ${historyTotals.seats} seats sold · ${taka(historyTotals.sales)}`
          }
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          }
        />
        {historyOpen && (
          <div className="flex flex-col border-t border-white/[0.06]">
            {finished.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#8e9a9d]">No finished trips yet. A trip closes by itself at its departure time.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 px-5 py-3.5 text-center">
                  <div className="flex flex-col rounded-2xl bg-black/20 px-2 py-2.5">
                    <span className="text-[10.5px] font-semibold text-[#8e9a9d]">Total sales</span>
                    <span className="text-[14px] font-bold tabular-nums">{taka(historyTotals.sales)}</span>
                  </div>
                  <div className="flex flex-col rounded-2xl bg-black/20 px-2 py-2.5">
                    <span className="text-[10.5px] font-semibold text-[#8e9a9d]">BusHub earned</span>
                    <span className="text-[14px] font-bold tabular-nums text-[#f5a524]">{taka(historyTotals.commission)}</span>
                  </div>
                  <div className="flex flex-col rounded-2xl bg-black/20 px-2 py-2.5">
                    <span className="text-[10.5px] font-semibold text-[#8e9a9d]">Companies&apos; share</span>
                    <span className="text-[14px] font-bold tabular-nums text-[#34d399]">{taka(historyTotals.payout)}</span>
                  </div>
                </div>
                <ul className="flex flex-col">
                  {shownHistory.map((b) => {
                    const s = sales.get(b._id) || { tickets: 0, seats: 0, boarded: 0, sales: 0, commission: 0, payout: 0 }
                    const unsold = Math.max(0, b.totalSeats - s.seats)
                    return (
                      <li key={b._id} className="flex flex-col gap-2.5 border-t border-white/[0.06] px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex min-w-0 grow flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-semibold">{b.busName}</span>
                              <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9ba7aa]">Closed</span>
                            </span>
                            <span className="truncate text-[12px] text-[#9ba7aa]">
                              {b.from} → {b.to} · {formatTripDate(b.date)}
                            </span>
                            <span className="truncate text-[12px] font-semibold text-[#e7e2da]">{tripTimes(b)}</span>
                            <span className="truncate text-[11.5px] text-[#6e7b7e]">{b.companyName}</span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-[14px] font-bold tabular-nums">{taka(s.sales)}</span>
                            <span className="text-[11.5px] tabular-nums text-[#9ba7aa]">
                              {s.seats}/{b.totalSeats} sold
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-2xl bg-black/20 px-3.5 py-2.5 text-[12px] sm:grid-cols-4">
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            Seats sold <b className="tabular-nums text-[#f6f4ef]">{s.seats}</b>
                          </span>
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            Seats unsold <b className="tabular-nums text-[#f6f4ef]">{unsold}</b>
                          </span>
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            Tickets <b className="tabular-nums text-[#f6f4ef]">{s.tickets}</b>
                          </span>
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            Boarded <b className="tabular-nums text-[#f6f4ef]">{s.boarded}</b>
                          </span>
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            BusHub <b className="tabular-nums text-[#f5a524]">{taka(s.commission)}</b>
                          </span>
                          <span className="flex justify-between gap-2 text-[#9ba7aa]">
                            Company balance <b className="tabular-nums text-[#34d399]">{taka(s.payout)}</b>
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrip(b, true)}
                            className="h-8 rounded-full bg-[#f87171]/[0.1] px-3.5 text-[11.5px] font-bold text-[#fca5a5] transition hover:bg-[#f87171]/[0.16]"
                          >
                            Delete from history
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {finished.length > historyShown && (
                  <button
                    type="button"
                    onClick={() => setHistoryShown((n) => n + HISTORY_PAGE)}
                    className="border-t border-white/[0.06] py-3 text-[12.5px] font-bold text-[#f5a524]"
                  >
                    Show {Math.min(HISTORY_PAGE, finished.length - historyShown)} more
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
