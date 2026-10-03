import { formatTripDate } from '@/lib/dates'
import { addMoney, COST_LABELS, type TripMoney } from '@/lib/tripMoney'
import { sumCell, type Cell, type Sheet } from '@/lib/sheet'
import { companyTripMoney, type CompanyTrip } from './types'

export function dhakaDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Every column that holds money or a count gets a SUM in the bold last row. */
function withTotal(sheet: Sheet, from: number): Sheet {
  sheet.total = sheet.header.map((_, c) => (c === 0 ? 'Total' : c >= from && sheet.rows.some((r) => typeof r[c] === 'number') ? sumCell(sheet, c) : ''))
  return sheet
}

export interface DayMoney {
  date: string
  trips: number
  m: TripMoney
}

/** The trips' money added up day by day, earliest day first. */
export function moneyByDate(trips: CompanyTrip[]): DayMoney[] {
  const days = new Map<string, TripMoney[]>()
  for (const t of trips) days.set(t.date, [...(days.get(t.date) || []), companyTripMoney(t)])
  return Array.from(days, ([date, list]) => ({ date, trips: list.length, m: addMoney(list) })).sort((a, b) => a.date.localeCompare(b.date))
}

const tripCells = (t: CompanyTrip): Cell[] => [t.date, t.departureTime, t.from, t.to, t.busName, t.plateNumber]
const TRIP_HEADER = ['Date', 'Time', 'From', 'To', 'Bus', 'Number plate']

/**
 * The manager's sales as a workbook: the money date by date, one row per trip, then every
 * counter seat, every BusHub ticket (code and seats, no passenger names) and every cost.
 */
export function companySalesSheets(trips: CompanyTrip[]): Sheet[] {
  const sorted = [...trips].sort((a, b) => a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime))

  const tripSheet = withTotal(
    {
      name: 'Trips',
      header: [
        ...TRIP_HEADER,
        'Seats',
        'Counter seats',
        'Counter money',
        'BusHub seats',
        'BusHub ticket money',
        'BusHub fee',
        'You get from BusHub',
        'Not sold',
        'Fuel',
        'Road',
        'Toll',
        'Other costs',
        'Costs total',
        'You receive',
        'Left after costs',
        'Status',
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
    },
    TRIP_HEADER.length
  )

  const counterSheet = withTotal(
    {
      name: 'Counter sales',
      header: [...TRIP_HEADER, 'Seat', 'Sold by', 'Sold at', 'Price'],
      rows: sorted.flatMap((t) => t.counterSeats.map((s) => [...tripCells(t), s.seat, s.soldBy, dhakaDateTime(s.soldAt), t.price])),
    },
    9
  )

  const onlineSheet = withTotal(
    {
      name: 'BusHub tickets',
      header: [...TRIP_HEADER, 'Ticket code', 'Seats', 'Seat count', 'Passenger paid', 'BusHub fee', 'You get', 'Boarded', 'Booked at'],
      rows: sorted.flatMap((t) =>
        (t.onlineTickets || []).map((o) => [
          ...tripCells(t),
          o.code,
          o.seats.join(', '),
          o.seats.length,
          o.total,
          o.total - o.payout,
          o.payout,
          o.boarded ? 'Yes' : 'No',
          dhakaDateTime(o.bookedAt),
        ])
      ),
    },
    8
  )

  const costSheet = withTotal(
    {
      name: 'Costs',
      header: [...TRIP_HEADER, 'Cost', 'Amount', 'Note', 'Added by', 'Added at'],
      rows: sorted.flatMap((t) =>
        (t.costs || []).map((c) => [...tripCells(t), COST_LABELS[c.type]?.en || c.type, c.amount, c.note, c.addedBy, dhakaDateTime(c.createdAt)])
      ),
    },
    7
  )

  const daySheet = withTotal(
    {
      name: 'Date by date',
      header: [
        'Date',
        'Day',
        'Trips',
        'Seats',
        'Seats sold',
        'Not sold',
        'Counter seats',
        'Counter money',
        'BusHub seats',
        'BusHub ticket money',
        'BusHub fee',
        'You get from BusHub',
        'All ticket money',
        'Fuel',
        'Road',
        'Toll',
        'Other costs',
        'Costs total',
        'You receive',
        'Left after costs',
      ],
      rows: moneyByDate(sorted).map(({ date, trips: n, m }) => [
        date,
        formatTripDate(date).split(' ')[0],
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
    },
    2
  )

  return [daySheet, tripSheet, counterSheet, onlineSheet, costSheet]
}
