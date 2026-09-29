import type { Db } from 'mongodb'

/**
 * Limits on one phone number, so nobody can buy up a bus to resell the seats or keep seats
 * locked by booking and never paying. A family or group still fits in one booking.
 */
export const MAX_SEATS_PER_PHONE_PER_TRIP = 6
export const MAX_OPEN_HOLDS_PER_PHONE = 2

/**
 * Why this phone can't book `seatsWanted` more seats on this trip, or null if it can. With
 * `alreadySaved` the new booking is already in the database and is counted as it is.
 */
export async function purchaseLimitError(
  db: Db,
  key: string,
  busId: string,
  seatsWanted: number,
  alreadySaved = false
): Promise<string | null> {
  if (!key) return null
  const now = new Date().toISOString()
  const extra = alreadySaved ? 0 : 1
  const extraSeats = alreadySaved ? 0 : seatsWanted

  const holds = await db.collection('bookings').countDocuments({
    phoneKey: key,
    status: 'pending',
    paymentStatus: 'pending',
    holdExpiresAt: { $gt: now },
  })
  if (holds + extra > MAX_OPEN_HOLDS_PER_PHONE) {
    return `This phone number already has ${MAX_OPEN_HOLDS_PER_PHONE} unpaid bookings. Pay for them, or wait 10 minutes for them to expire.`
  }

  const onTrip = await db
    .collection('bookings')
    .find({
      phoneKey: key,
      busId,
      $or: [{ status: 'confirmed' }, { status: 'pending', holdExpiresAt: { $gt: now } }],
    })
    .project({ seats: 1 })
    .toArray()
  const seats = onTrip.reduce((n, b) => n + (Array.isArray(b.seats) ? b.seats.length : 0), 0)
  if (seats + extraSeats > MAX_SEATS_PER_PHONE_PER_TRIP) {
    const left = Math.max(0, MAX_SEATS_PER_PHONE_PER_TRIP - (alreadySaved ? seats - seatsWanted : seats))
    return left === 0
      ? `One phone number can book at most ${MAX_SEATS_PER_PHONE_PER_TRIP} seats on the same bus, and this number already has ${MAX_SEATS_PER_PHONE_PER_TRIP}.`
      : `One phone number can book at most ${MAX_SEATS_PER_PHONE_PER_TRIP} seats on the same bus. This number can add ${left} more.`
  }
  return null
}
