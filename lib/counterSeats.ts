import { ObjectId, type Db } from 'mongodb'
import { releaseExpiredHolds, repairWronglyExpiredTickets } from './seatHold'
import { seatSelectionError } from './seats'
import { tripDeparted } from './trips'

/** Who is marking seats sold at the counter: the BusHub admin, or someone at the bus company. */
export type SeatActor =
  | { kind: 'admin' }
  | { kind: 'company'; companyId: string; role: 'manager' | 'counter'; staffId?: string; name: string }

export interface SeatResult {
  status: number
  body: { bus?: unknown; error?: string }
}

const fail = (status: number, error: string): SeatResult => ({ status, body: { error } })

/**
 * Marks seats sold at the counter, or frees them again. A seat sold on BusHub belongs to a paying
 * passenger and is never touched; a seat is only marked if no customer grabbed it a moment ago, so
 * the same seat can never be sold online and at the counter. Each counter sale records who made it.
 * A counter login may only undo its own sales; the manager and the admin may undo any.
 */
export async function changeCounterSeats(
  db: Db,
  busId: string,
  seats: unknown,
  action: 'sell' | 'unsell',
  actor: SeatActor
): Promise<SeatResult> {
  if (!ObjectId.isValid(busId)) return fail(400, 'Invalid trip')
  const bus = await db.collection('buses').findOne({ _id: new ObjectId(busId) })
  if (!bus) return fail(404, 'Trip not found')
  if (actor.kind === 'company') {
    if (bus.companyId !== actor.companyId) return fail(403, 'This trip belongs to another company')
    if (tripDeparted(bus.date, bus.departureTime)) return fail(409, 'This bus has already left')
  }

  const seatProblem = seatSelectionError(seats, bus.totalSeats, bus.totalSeats)
  if (seatProblem) return fail(400, seatProblem)
  const list = seats as string[]

  // An unpaid online hold that ran out frees its seats first, so the counter can sell them.
  await releaseExpiredHolds(db, busId)
  await repairWronglyExpiredTickets(db, { busId })

  const liveBookings = await db
    .collection('bookings')
    .find({ busId, status: { $in: ['pending', 'confirmed'] }, seats: { $in: list } })
    .toArray()
  const online = list.find((seat) => liveBookings.some((b) => (b.seats || []).includes(seat)))
  if (online) {
    const paid = liveBookings.some((b) => b.paymentStatus === 'paid' && (b.seats || []).includes(online))
    return fail(409, paid ? `Seat ${online} is sold on BusHub.` : `Seat ${online} is being bought on BusHub right now.`)
  }

  if (action === 'unsell' && actor.kind === 'company' && actor.role === 'counter') {
    const sales = await db.collection('counterSales').find({ busId, seat: { $in: list } }).toArray()
    const notMine = list.find((seat) => {
      const sale = sales.find((s) => s.seat === seat)
      return !sale || sale.staffId !== actor.staffId
    })
    if (notMine) {
      const sale = sales.find((s) => s.seat === notMine)
      return fail(403, `Seat ${notMine} was sold by ${sale?.soldBy || 'someone else'}. Ask your manager to undo it.`)
    }
  }

  const filter =
    action === 'sell'
      ? // Only if nobody bought these seats online, or sold them at a counter, a moment ago.
        { _id: bus._id, bookedSeats: { $nin: list }, ...(actor.kind === 'company' ? { blockedSeats: { $nin: list } } : {}) }
      : { _id: bus._id }
  const update =
    action === 'sell'
      ? { $addToSet: { blockedSeats: { $each: list } } }
      : // Also clear any leftover bookedSeats entry with no booking behind it — seats marked sold
        // by hand before counter sales had their own list.
        { $pull: { blockedSeats: { $in: list }, bookedSeats: { $in: list } } }
  const result = await db.collection('buses').updateOne(filter, update as any)
  if (result.matchedCount === 0) {
    return fail(409, 'One of these seats was just sold. Refresh and try again.')
  }

  if (action === 'sell') {
    const soldAt = new Date().toISOString()
    const by =
      actor.kind === 'admin'
        ? { soldBy: 'BusHub admin', role: 'admin' }
        : { soldBy: actor.name, role: actor.role, ...(actor.staffId ? { staffId: actor.staffId } : {}) }
    await db.collection('counterSales').bulkWrite(
      list.map((seat) => ({
        updateOne: {
          filter: { busId, seat },
          update: { $set: { busId, seat, companyId: bus.companyId, soldAt, ...by } },
          upsert: true,
        },
      }))
    )
  } else {
    await db.collection('counterSales').deleteMany({ busId, seat: { $in: list } })
  }

  const updated = await db.collection('buses').findOne({ _id: bus._id })
  return { status: 200, body: { bus: updated } }
}
