import { ObjectId, type Db } from 'mongodb'
import { isDuplicateKeyError } from './db'
import type { Bus } from './models'
import { DEFAULT_COMMISSION_RATE } from './tickets'
import { getPlaces } from './places'
import { dhakaDate } from './scan'
import { dhakaClock, tripDeparted } from './trips'
import { cleanBoardingPoint, cleanMapUrl } from './boarding'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export interface TripResult {
  status: number
  body: { bus?: Omit<Bus, '_id'> & { _id: unknown }; error?: string }
}

const fail = (status: number, error: string): TripResult => ({ status, body: { error } })

/**
 * Adds a trip. The bus is picked from the bus list; its name, company, type, seats and logo are
 * copied from there, never typed, so every ticket names the company that scans it. The BusHub
 * admin may use any bus; a bus company (`onlyCompanyId`) only its own.
 */
export async function createTrip(db: Db, input: Record<string, any>, onlyCompanyId?: string): Promise<TripResult> {
  const { fleetId, from, to, date, departureTime } = input
  const arrivalTime = input.arrivalTime ? String(input.arrivalTime) : ''
  const price = Number(input.price)
  const boardingPoint = cleanBoardingPoint(input.boardingPoint)
  const boardingMapUrl = cleanMapUrl(input.boardingMapUrl)

  if (typeof fleetId !== 'string' || !ObjectId.isValid(fleetId)) return fail(400, 'Choose the bus from your bus list')
  if (!from || !to || from === to) return fail(400, 'Choose two different cities')
  if (!DATE.test(String(date)) || !TIME.test(String(departureTime)) || (arrivalTime && !TIME.test(arrivalTime))) {
    return fail(400, 'Check the date and times')
  }
  if (!Number.isFinite(price) || price <= 0) return fail(400, 'Enter the fare')
  if (boardingMapUrl === null) return fail(400, 'The map link must start with https://')
  if (date < dhakaDate()) return fail(400, 'That date has already passed')
  if (tripDeparted(date, departureTime)) return fail(400, `That time has already passed today (it is ${dhakaClock()} now)`)

  const { cities } = await getPlaces(db)
  if (!cities.includes(from) || !cities.includes(to)) return fail(400, 'Choose both cities from the city list')
  const fleetBus = await db.collection('fleet').findOne({ _id: new ObjectId(fleetId) })
  if (!fleetBus) return fail(400, 'That bus is not on the bus list')
  if (onlyCompanyId && fleetBus.companyId !== onlyCompanyId) return fail(403, 'That bus belongs to another company')
  // BusHub's commission is set once on the bus, not typed for every trip.
  const commissionRate = Number.isFinite(fleetBus.commissionRate) ? Number(fleetBus.commissionRate) : DEFAULT_COMMISSION_RATE
  const company = ObjectId.isValid(fleetBus.companyId)
    ? await db.collection('companies').findOne({ _id: new ObjectId(fleetBus.companyId) })
    : null
  if (!company || company.status !== 'approved') return fail(400, `${fleetBus.companyName} is not an approved company right now`)

  // One bus can't leave twice at the same moment.
  const clash = await db
    .collection('buses')
    .findOne({ fleetId, date, departureTime, status: 'active' }, { projection: { from: 1, to: 1 } })
  if (clash) return fail(409, `${fleetBus.name} already has a trip on ${date} at ${departureTime} (${clash.from} → ${clash.to})`)

  const bus: Bus = {
    fleetId,
    companyId: company._id.toString(),
    companyName: company.name,
    busName: fleetBus.name,
    busType: fleetBus.busType,
    logoUrl: fleetBus.logoUrl,
    from,
    to,
    date,
    departureTime,
    arrivalTime,
    ...(boardingPoint ? { boardingPoint } : {}),
    ...(boardingMapUrl ? { boardingMapUrl } : {}),
    price,
    totalSeats: fleetBus.totalSeats,
    bookedSeats: [],
    blockedSeats: [],
    commissionRate,
    status: 'active',
    createdAt: new Date().toISOString(),
  }

  try {
    const result = await db.collection('buses').insertOne({ ...bus } as any)
    return { status: 201, body: { bus: { ...bus, _id: result.insertedId } } }
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err
    return fail(409, `${fleetBus.name} already has a trip on ${date} at ${departureTime}`)
  }
}
