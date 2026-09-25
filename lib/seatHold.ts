import { Db, ObjectId } from 'mongodb'

/**
 * Paid tickets used to be marked expired 24 hours after booking (see ticketExpiry), which
 * also dropped them from sales totals and payouts. Only unpaid holds can really expire, so
 * any paid ticket in that state is put back to confirmed.
 */
export async function repairWronglyExpiredTickets(db: Db, filter: Record<string, unknown> = {}) {
  await db
    .collection('bookings')
    .updateMany({ ...filter, paymentStatus: 'paid', status: 'expired' }, { $set: { status: 'confirmed' } })
}

/**
 * Frees the seats of unpaid holds whose 10 minutes have run out. Each hold is claimed with a
 * single conditional update before its seats are released, so when several requests notice
 * the same hold at once only one of them releases it. Otherwise a late duplicate could free a
 * seat that a new customer had just bought.
 */
export async function releaseExpiredHolds(db: Db, busId: string) {
  const expiredHolds = await db
    .collection('bookings')
    .find({ busId, status: 'pending', paymentStatus: 'pending', holdExpiresAt: { $lt: new Date().toISOString() } })
    .project({ _id: 1, seats: 1 })
    .toArray()

  for (const hold of expiredHolds) {
    const claimed = await db
      .collection('bookings')
      .updateOne({ _id: hold._id, status: 'pending', paymentStatus: 'pending' }, { $set: { status: 'expired' } })
    if (claimed.modifiedCount === 1 && ObjectId.isValid(busId)) {
      await db
        .collection('buses')
        .updateOne({ _id: new ObjectId(busId) }, { $pull: { bookedSeats: { $in: hold.seats as string[] } } } as any)
    }
  }
}
