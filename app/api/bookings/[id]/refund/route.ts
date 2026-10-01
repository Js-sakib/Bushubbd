import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { repairWronglyExpiredTickets } from '@/lib/seatHold'
import { recordRefundDeduction, releaseInvoice } from '@/lib/payouts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Refunds a paid ticket and puts its seats back on sale. Admin only: bus companies ask the
 * BusHub team. The status change is one conditional update, so the same ticket can't be
 * refunded twice, and a passenger who has already boarded keeps their seat. A ticket already in a
 * payout invoice to the bus company is handled after the refund (see below).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Only the BusHub admin can refund tickets' }, { status: 403 })
    }

    const { db } = await connectToDatabase()
    const query = ObjectId.isValid(params.id) ? { _id: new ObjectId(params.id) } : { bookingCode: params.id }
    await repairWronglyExpiredTickets(db, query)

    const refundedAt = new Date().toISOString()
    const result = await db
      .collection('bookings')
      .updateOne({ ...query, paymentStatus: 'paid', status: 'confirmed', checkedIn: { $ne: true } }, { $set: { status: 'refunded', refundedAt } })
    const booking = await db.collection('bookings').findOne(query)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (result.modifiedCount === 0) {
      const error = booking.checkedIn
        ? 'This passenger has already boarded, so the ticket cannot be refunded'
        : booking.status === 'refunded'
          ? 'This ticket is already refunded'
          : 'Only a paid, confirmed booking can be refunded'
      return NextResponse.json({ error }, { status: 409 })
    }

    // A ticket already in a payout invoice to the bus company: an unpaid invoice is cancelled
    // (its other tickets go back to owed, for a new invoice); if BusHub has already paid for the
    // ticket, the company owes that back and it comes off its next payment.
    let note = ''
    const invoice = booking.payoutId && ObjectId.isValid(booking.payoutId) ? await db.collection('payouts').findOne({ _id: new ObjectId(booking.payoutId) }) : null
    if (invoice?.status === 'unpaid') {
      const cancelled = await db.collection('payouts').updateOne(
        { _id: invoice._id, status: 'unpaid' },
        { $set: { status: 'cancelled' }, $push: { history: { at: refundedAt, by: 'BusHub admin', event: `Cancelled: ticket ${booking.bookingCode} refunded` } } } as any
      )
      if (cancelled.modifiedCount > 0) await releaseInvoice(db, invoice._id.toString())
      note = `Invoice ${invoice.number} was not paid yet, so it was cancelled. Make a new invoice for the other tickets.`
    } else if (invoice && invoice.status !== 'cancelled') {
      await recordRefundDeduction(db, booking, invoice)
      note = `BusHub already paid ${invoice.companyName} for this ticket (invoice ${invoice.number}); it will be taken from their next payment.`
    }

    await db
      .collection('buses')
      .updateOne({ _id: new ObjectId(booking.busId) }, { $pull: { bookedSeats: { $in: booking.seats } } } as any)

    return NextResponse.json({ booking, note })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to refund booking' }, { status: 500 })
  }
}
