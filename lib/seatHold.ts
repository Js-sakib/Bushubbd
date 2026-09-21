import { Db, ObjectId } from 'mongodb'
import { isExpired } from './tickets'

export async function releaseExpiredHolds(db: Db, busId: string) {
  const pendingHolds = await db
    .collection('bookings')
    .find({ busId, status: 'pending', paymentStatus: 'pending' })
    .toArray()

  const expiredHolds = pendingHolds.filter((b) => b.holdExpiresAt && isExpired(b.holdExpiresAt))
  if (expiredHolds.length === 0) return

  const seatsToRelease = expiredHolds.flatMap((b) => b.seats as string[])
  const bookingIds = expiredHolds.map((b) => b._id)

  await db.collection('buses').updateOne(
    { _id: new ObjectId(busId) },
    { $pull: { bookedSeats: { $in: seatsToRelease } } } as any
  )
  await db.collection('bookings').updateMany({ _id: { $in: bookingIds } }, { $set: { status: 'expired' } })
}
