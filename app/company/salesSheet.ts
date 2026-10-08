import { formatTripDate } from '@/lib/dates'
import { addMoney, COST_LABELS, type TripMoney } from '@/lib/tripMoney'
import { sheetDate, type Cell, type Column, type Sheet } from '@/lib/sheet'
import { companyTripMoney, type CompanyTrip } from './types'

export function dhakaDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

export interface DayMoney {
  date: string
  trips: number
  m: TripMoney
}

export interface DayBusMoney extends DayMoney {
  busName: string
  plateNumber: string
}

/** The trips' money added up per day and per bus, earliest day first, then by number plate. */
export function moneyByDateAndBus(trips: CompanyTrip[]): DayBusMoney[] {
  const rows = new Map<string, { date: string; busName: string; plateNumber: string; list: TripMoney[] }>()
  for (const t of trips) {
    const key = `${t.date}|${t.fleetId || t.busName}`
    const row = rows.get(key) || { date: t.date, busName: t.busName, plateNumber: t.plateNumber, list: [] }
    row.list.push(companyTripMoney(t))
    rows.set(key, row)
  }
  return Array.from(rows.values())
    .map((r) => ({ date: r.date, busName: r.busName, plateNumber: r.plateNumber, trips: r.list.length, m: addMoney(r.list) }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.plateNumber || a.busName).localeCompare(b.plateNumber || b.busName))
}

/** "Date range: 01-Oct-2026 to 03-Oct-2026", from the dates in the list. */
export function dateRangeNote(dates: string[]): string {
  if (dates.length === 0) return 'Date range: none'
  const sorted = [...dates].sort()
  return `Date range: ${sheetDate(sorted[0])} to ${sheetDate(sorted[sorted.length - 1])}`
}

const int = (header: string): Column => ({ header, kind: 'int', total: true })
const money = (header: string): Column => ({ header, kind: 'money', total: true })
const TRIP_COLUMNS: Column[] = [{ header: 'Date', kind: 'date' }, { header: 'Day' }, { header: 'Time' }, { header: 'From' }, { header: 'To' }, { header: 'Bus' }, { header: 'Number plate' }]
const tripCells = (t: CompanyTrip): Cell[] => [t.date, formatTripDate(t.date).split(' ')[0], t.departureTime, t.from, t.to, t.busName, t.plateNumber]

/**
 * The manager's sales as a workbook: the money date by date, one row per trip, then every
 * counter seat, every BusHub ticket (code and seats, no passenger names) and every cost.
 */
export function companySalesSheets(trips: CompanyTrip[], companyName: string, filters: string[] = []): Sheet[] {
  const sorted = [...trips].sort((a, b) => a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime))
  const notes = [`Company: ${companyName}`, dateRangeNote(sorted.map((t) => t.date)), ...filters]

  const daySheet: Sheet = {
    name: 'Date by date',
    title: 'BusHub sales · date by date, bus by bus',
    notes: [...notes, 'Filter Date for one day\'s total, or Number plate for one bus.'],
    columns: [
      { header: 'Date', kind: 'date' },
      { header: 'Day' },
      { header: 'Number plate' },
      { header: 'Bus' },
      int('Trips'),
      int('Seats'),
      int('Seats sold'),
      int('Not sold'),
      int('Counter seats'),
      money('Counter money'),
      int('BusHub seats'),
      money('BusHub ticket money'),
      money('BusHub fee'),
      money('You get from BusHub'),
      money('All ticket money'),
      money('Fuel'),
      money('Road'),
      money('Toll'),
      money('Other costs'),
      money('Costs total'),
      money('You receive'),
      money('Left after costs'),
    ],
    rows: moneyByDateAndBus(sorted).map(({ date, busName, plateNumber, trips: n, m }) => [
      date,
      formatTripDate(date).split(' ')[0],
      plateNumber || '—',
      busName,
      n,
      m.seats.total,
      m.seats.online + m.seats.counter,
      m.seats.notSold,
      m.counter.seats,
      m.counter.total,
      m.seats.online,
      m.online.total,
      m.online.fee,
      m.online.payout,
      m.ticketMoney,
      m.costs.fuel,
      m.costs.road,
      m.costs.toll,
      m.costs.other,
      m.costs.total,
      m.companyGets,
      m.left,
    ]),
  }

  const tripSheet: Sheet = {
    name: 'Trips',
    title: 'BusHub sales · trip by trip',
    notes,
    columns: [
      ...TRIP_COLUMNS,
      int('Seats'),
      int('Counter seats'),
      money('Counter money'),
      int('BusHub seats'),
      money('BusHub ticket money'),
      money('BusHub fee'),
      money('You get from BusHub'),
      int('Not sold'),
      money('Fuel'),
      money('Road'),
      money('Toll'),
      money('Other costs'),
      money('Costs total'),
      money('You receive'),
      money('Left after costs'),
      { header: 'Status' },
    ],
    rows: sorted.map((t) => {
      const m = companyTripMoney(t)
      return [
        ...tripCells(t),
        m.seats.total,
        m.counter.seats,
        m.counter.total,
        m.seats.online,
        m.online.total,
        m.online.fee,
        m.online.payout,
        m.seats.notSold,
        m.costs.fuel,
        m.costs.road,
        m.costs.toll,
        m.costs.other,
        m.costs.total,
        m.companyGets,
        m.left,
        t.departed ? 'Finished' : 'Upcoming',
      ]
    }),
  }

  const counterSheet: Sheet = {
    name: 'Counter sales',
    title: 'Counter sales · every seat',
    notes,
    columns: [...TRIP_COLUMNS, { header: 'Seat' }, { header: 'Sale no.' }, { header: 'Sold by' }, { header: 'Sold at', kind: 'datetime' }, money('Price')],
    rows: sorted.flatMap((t) => t.counterSeats.map((s) => [...tripCells(t), s.seat, s.ticketCode || '', s.soldBy, s.soldAt, typeof s.fare === 'number' ? s.fare : t.price])),
  }

  const onlineSheet: Sheet = {
    name: 'BusHub tickets',
    title: 'BusHub tickets · sold online',
    notes,
    columns: [
      ...TRIP_COLUMNS,
      { header: 'Ticket code' },
      { header: 'Seats' },
      int('Seat count'),
      money('Passenger paid'),
      money('BusHub fee'),
      money('You get'),
      { header: 'Boarded' },
      { header: 'Booked at', kind: 'datetime' },
    ],
    rows: sorted.flatMap((t) =>
      (t.onlineTickets || []).map((o) => [...tripCells(t), o.code, o.seats.join(', '), o.seats.length, o.total, o.total - o.payout, o.payout, o.boarded ? 'Yes' : 'No', o.bookedAt])
    ),
  }

  const costSheet: Sheet = {
    name: 'Costs',
    title: 'Trip costs · fuel, road, toll, other',
    notes,
    columns: [...TRIP_COLUMNS, { header: 'Cost' }, money('Amount'), { header: 'Note', kind: 'wrap' }, { header: 'Added by' }, { header: 'Added at', kind: 'datetime' }],
    rows: sorted.flatMap((t) => (t.costs || []).map((c) => [...tripCells(t), COST_LABELS[c.type]?.en || c.type, c.amount, c.note, c.addedBy, c.createdAt])),
  }

  return [daySheet, tripSheet, counterSheet, onlineSheet, costSheet]
}
