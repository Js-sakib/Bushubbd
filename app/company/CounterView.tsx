'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import SeatMap, { seatKinds, type SeatKind } from './SeatMap'
import TripForm from './TripForm'
import TripPicker from './TripPicker'
import CounterSale from './CounterSale'
import CounterTicketSheet from './CounterTicketSheet'
import DaySales from './DaySales'
import { ReceiptPrinter, usePrinterWidth, type CounterTicketView, type PrintJob } from './Receipt'
import { changeSeat, useTrips } from './useTrips'
import { tripCounts, type CompanyTrip } from './types'
import Plate from '../Plate'

function dhakaTime(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** The seats behind a tapped number: which are free, which sold online, and who sold which at the counter. */
function SeatDetail({ trip, kind, myStaffId }: { trip: CompanyTrip; kind: 'free' | 'online' | 'counter'; myStaffId: string | null }) {
  const kinds = seatKinds(trip, myStaffId)
  const of = (...want: SeatKind[]) => Array.from(kinds).filter(([, k]) => want.includes(k)).map(([s]) => s)
  const box = 'flex flex-col gap-2 rounded-2xl border border-[#f2661d]/30 bg-white/80 px-3.5 py-3 text-[12.5px]'
  if (kind === 'free') {
    const free = of('free')
    return (
      <div className={box}>
        <span className="font-bold">{free.length} free seats, outlined on the map</span>
        <span className="leading-relaxed text-[#3f3f3f]">{free.join(', ') || 'None: the bus is full.'}</span>
      </div>
    )
  }
  if (kind === 'online') {
    const sold = of('online')
    const held = of('held')
    return (
      <div className={box}>
        <span className="font-bold">{sold.length} sold on BusHub</span>
        <span className="text-[#3f3f3f]">{sold.join(', ') || 'None yet.'}</span>
        {held.length > 0 && <span className="text-[#3f3f3f]">Being bought online right now: {held.join(', ')}</span>}
      </div>
    )
  }
  const bySeller = new Map<string, { seats: string[]; last: string | null }>()
  for (const s of trip.counterSeats) {
    const row = bySeller.get(s.soldBy) || { seats: [], last: null }
    row.seats.push(s.seat)
    if (s.soldAt && (!row.last || s.soldAt > row.last)) row.last = s.soldAt
    bySeller.set(s.soldBy, row)
  }
  return (
    <div className={box}>
      <span className="font-bold">{trip.counterSeats.length} sold at the counter</span>
      {bySeller.size === 0 && <span className="text-[#3f3f3f]">None yet.</span>}
      {Array.from(bySeller).map(([seller, row]) => (
        <div key={seller} className="flex items-start justify-between gap-3">
          <span className="font-semibold">{seller}</span>
          <span className="text-right text-[#3f3f3f]">
            {row.seats.length} · {row.seats.join(', ')}
            {row.last && <span className="block text-[11px] text-[#5e5e5e]">last at {dhakaTime(row.last)}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

const TABS = [
  ['sell', 'Sell tickets'],
  ['day', 'Today’s sales'],
  ['add', 'Add trip'],
] as const

/**
 * The counter's page. Pick the trip, tap the seats the passenger wants, take the phone and name,
 * cash/bKash/Nagad, and press Enter: the seats come off sale everywhere at once and the ticket
 * prints on the receipt printer with a QR the bus staff scan. Today's sales shows the money to hand
 * over and prints the day closing.
 */
export default function CounterView() {
  const { data, reload } = useTrips()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('sell')
  const [busId, setBusId] = useState('')
  const [tripId, setTripId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busySeat, setBusySeat] = useState<string | null>(null)
  const [detail, setDetail] = useState<'free' | 'online' | 'counter' | null>(null)
  const [lastSold, setLastSold] = useState<CounterTicketView | null>(null)
  const [open, setOpen] = useState<CounterTicketView | null>(null)
  const [job, setJob] = useState<PrintJob | null>(null)
  const [width, setWidth] = usePrinterWidth()
  const [dayKey, setDayKey] = useState(0)

  useEffect(() => {
    setDetail(null)
    setPicked([])
  }, [tripId])

  const trips = data?.trips ?? []
  const trip = trips.find((t) => t._id === tripId) || null
  useEffect(() => {
    if (tripId && data && !trip) setTripId(null)
  }, [tripId, data, trip])
  // A seat sold online (or by another counter) since it was picked drops out of the sale.
  useEffect(() => {
    if (!trip) return
    const kinds = seatKinds(trip, data?.me.staffId)
    setPicked((p) => p.filter((s) => kinds.get(s) === 'free'))
  }, [trip, data?.me.staffId])

  // Esc clears the sale, on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tab === 'sell' && !open) setPicked([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, open])

  // The phone's "Take payment" bar steps aside once the sale form itself is on screen.
  const [formInView, setFormInView] = useState(false)
  useEffect(() => {
    const form = document.getElementById('counter-sale')
    if (!form || typeof IntersectionObserver === 'undefined') return setFormInView(false)
    const io = new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), { threshold: 0.15 })
    io.observe(form)
    return () => io.disconnect()
  }, [tab, tripId, data])

  const openTicket = async (code: string) => {
    const res = await fetch(`/api/company/counter-tickets/${code}`, { cache: 'no-store' }).catch(() => null)
    const d = res ? await res.json().catch(() => null) : null
    if (d?.ticket) setOpen(d.ticket)
    else toast.error(d?.error || 'Could not open the ticket')
  }

  const tap = async (seat: string, kind: SeatKind) => {
    if (!trip || !data) return
    if (kind === 'online') return toast(`Seat ${seat} is sold on BusHub.`)
    if (kind === 'held') return toast(`Someone is buying seat ${seat} online right now.`)
    if (kind === 'free') {
      setPicked((p) => (p.includes(seat) ? p.filter((s) => s !== seat) : [...p, seat]))
      return
    }
    const sale = trip.counterSeats.find((c) => c.seat === seat)
    // A seat sold with a printed ticket opens that ticket (reprint, cancel).
    if (sale?.ticketCode && (kind === 'mine' || data.me.role === 'manager')) return openTicket(sale.ticketCode)
    if (kind === 'counter') return toast(`Seat ${seat} was sold by ${sale?.soldBy || 'another counter'}.`)
    // Seats marked sold before printed tickets: free them the old way.
    if (!confirm(`Free seat ${seat} again? It goes back on sale online.`)) return
    setBusySeat(seat)
    await changeSeat(trip, seat, 'unsell')
    await reload()
    setBusySeat(null)
  }

  const onSold = async (ticket: CounterTicketView, print: boolean) => {
    setPicked([])
    setLastSold(ticket)
    setDayKey((k) => k + 1)
    if (print) setJob({ kind: 'ticket', ticket })
    await reload()
  }
  const donePrinting = useCallback(() => setJob(null), [])

  if (!data) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading trips...</div>
  const c = trip ? tripCounts(trip) : null
  const mine = trip ? trip.counterSeats.filter((s) => s.staffId === data.me.staffId).map((s) => s.seat) : []

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`chip ${tab === id ? 'chip-active' : ''}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/70 p-1 text-[11.5px] font-bold" role="group" aria-label="Receipt printer width">
          <span className="px-2 text-[#4a4a4a]">Printer</span>
          {([58, 80] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} className={`h-7 rounded-full px-2.5 ${width === w ? 'bg-[#0a8a84] text-white' : 'text-[#3f3f3f]'}`}>
              {w} mm
            </button>
          ))}
        </div>
      </div>

      {tab === 'add' && (
        <TripForm
          fleet={data.fleet}
          cities={data.cities}
          trips={trips}
          onCreated={async (id) => {
            await reload()
            setTripId(id)
            setTab('sell')
          }}
        />
      )}

      {tab === 'day' && (
        <DaySales company={lastSold?.companyName || ''} refreshKey={dayKey} onOpen={setOpen} onPrint={setJob} />
      )}

      {tab === 'sell' && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:items-start">
          <TripPicker fleet={data.fleet} trips={trips} busId={busId} onBus={setBusId} tripId={tripId} onTrip={setTripId} />
          {trip && c && (
            <div className="flex flex-col gap-4">
              {lastSold && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#3fd0c9] bg-[#3fd0c9]/10 px-4 py-3">
                  <span className="flex min-w-0 grow flex-col">
                    <span className="text-[13.5px] font-bold text-[#0a6e69]">
                      Sold · seats {lastSold.seats.join(', ')} · ৳{lastSold.total.toLocaleString('en-US')}
                    </span>
                    <span className="truncate text-[11.5px] text-[#3f3f3f]">
                      {lastSold.ticketCode}
                      {lastSold.passengerName ? ` · ${lastSold.passengerName}` : ''}
                    </span>
                  </span>
                  <button type="button" onClick={() => setJob({ kind: 'ticket', ticket: lastSold })} className="glass-btn h-10 px-4 text-[13px]">
                    Print
                  </button>
                  <button type="button" onClick={() => setLastSold(null)} className="text-[12px] font-bold text-[#0b7f8c]" aria-label="Dismiss">
                    ✕
                  </button>
                </div>
              )}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
                <div className="glass-lite flex flex-col gap-4 p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 display text-[17px] font-bold">
                      <span className="truncate">
                        {trip.from} → {trip.to} · {trip.departureTime}
                      </span>
                      <Plate plate={trip.plateNumber} />
                    </span>
                    <span className="text-[12px] text-[#3f3f3f]">
                      {formatTripDate(trip.date)} · {trip.busName} · ৳{trip.price}
                      {trip.boardingPoint ? ` · ${trip.boardingPoint}` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(
                      [
                        ['free', c.free, 'Free', 'bg-white text-[#111111] border border-[#111111]/15'],
                        ['online', c.online + c.held, 'BusHub', 'bg-gradient-to-br from-[#f2661d] to-[#feb249] text-[#170b02]'],
                        ['counter', c.counter, 'Counter', 'bg-[#4a9aa8] text-white'],
                      ] as const
                    ).map(([id, n, label, tone]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDetail(detail === id ? null : id)}
                        aria-pressed={detail === id}
                        className={`rounded-xl py-2 transition hover:-translate-y-0.5 ${tone} ${detail === id ? 'ring-[3px] ring-[#f2661d] ring-offset-2' : ''}`}
                      >
                        <div className="display text-[18px] font-bold">{n}</div>
                        <div className="text-[10.5px] font-semibold opacity-85">{label} · Details ›</div>
                      </button>
                    ))}
                  </div>
                  {detail && <SeatDetail trip={trip} kind={detail} myStaffId={data.me.staffId} />}
                  <p className="text-[12px] text-[#222222]">Tap free seats to add them to the sale. Tap a seat you sold to reprint or cancel its ticket.</p>
                  <SeatMap
                    trip={trip}
                    myStaffId={data.me.staffId}
                    busySeat={busySeat}
                    onTap={tap}
                    selected={picked}
                    highlight={detail === 'free' ? ['free'] : detail === 'online' ? ['online', 'held'] : detail === 'counter' ? ['counter', 'mine'] : []}
                  />
                  {mine.length > 0 && (
                    <p className="text-[12px] text-[#222222]">
                      You sold <b>{mine.length}</b> on this trip: {mine.join(', ')}
                    </p>
                  )}
                </div>
                <div className="xl:sticky xl:top-4">
                  <CounterSale trip={trip} seats={picked} onRemoveSeat={(s) => setPicked((p) => p.filter((x) => x !== s))} onClear={() => setPicked([])} onSold={onSold} />
                </div>
              </div>
            </div>
          )}
          {!trip && (
            <div className="glass-lite hidden flex-col items-center justify-center gap-1 p-10 text-center lg:flex">
              <span className="display text-[16px] font-bold">Choose a trip</span>
              <span className="text-[12.5px] text-[#3f3f3f]">Its seats show here. Tap the seats the passenger wants, then take the payment.</span>
            </div>
          )}
        </div>
      )}

      {/* On a phone the sale form sits under the map: a bar keeps the total in view. */}
      {tab === 'sell' && trip && picked.length > 0 && !formInView && (
        <a href="#counter-sale" className="fixed inset-x-3 bottom-20 z-40 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#feb249] to-[#f2661d] px-4 py-3 font-bold text-[#1a0d03] shadow-lg xl:hidden">
          <span>
            {picked.length} seat{picked.length === 1 ? '' : 's'} · {picked.join(', ')}
          </span>
          <span>Take payment ↓</span>
        </a>
      )}

      {open && (
        <CounterTicketSheet
          ticket={open}
          canCancel={data.me.role === 'manager' || open.staffId === data.me.staffId}
          onClose={() => setOpen(null)}
          onPrint={() => setJob({ kind: 'ticket', ticket: open, copy: true })}
          onCancelled={async () => {
            setOpen(null)
            setDayKey((k) => k + 1)
            if (lastSold?.ticketCode === open.ticketCode) setLastSold(null)
            await reload()
          }}
        />
      )}
      <ReceiptPrinter job={job} width={width} onDone={donePrinting} />
    </div>
  )
}
