import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { PUBLIC_REVIEW_LIMIT, Review, cleanReview, toPublicReview } from '@/lib/reviews'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const CODE = /^[A-Z0-9-]{6,40}$/

/**
 * GET with no query: the reviews the home page shows, newest first, with the average rating.
 * GET ?bookingCode=…: that ticket's own review, so its holder can see or change it.
 */
export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const code = (req.nextUrl.searchParams.get('bookingCode') || '').trim().toUpperCase()
    if (code) {
      if (!CODE.test(code)) return NextResponse.json({ review: null })
      const review = await db.collection<Review>('reviews').findOne({ bookingCode: code })
      return NextResponse.json({
        review: review ? { name: review.name, rating: review.rating, text: review.text, hidden: review.hidden } : null,
      })
    }

    const visible = { hidden: { $ne: true } }
    const [reviews, totals] = await Promise.all([
      db.collection<Review>('reviews').find(visible).sort({ createdAt: -1 }).limit(PUBLIC_REVIEW_LIMIT).toArray(),
      db
        .collection<Review>('reviews')
        .aggregate<{ count: number; average: number }>([
          { $match: visible },
          { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
        ])
        .toArray(),
    ])
    const summary = totals[0] ? { count: totals[0].count, average: Math.round(totals[0].average * 10) / 10 } : { count: 0, average: 0 }
    return NextResponse.json({ reviews: reviews.map(toPublicReview), summary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 })
  }
}

/**
 * Saves the review for one ticket. Only a paid ticket that was not refunded can be reviewed, and
 * the ticket code (which only its holder has) is the proof. Sending again changes the review;
 * a review the admin hid stays hidden.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const code = String(body?.bookingCode || '')
      .trim()
      .toUpperCase()
    if (!CODE.test(code)) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    const clean = cleanReview(body)
    if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 })

    const { db } = await connectToDatabase()
    const booking = await db.collection('bookings').findOne({ bookingCode: code })
    if (!booking || booking.paymentStatus !== 'paid' || booking.status === 'refunded' || booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Only a paid ticket can be reviewed' }, { status: 403 })
    }

    const now = new Date().toISOString()
    await db.collection<Review>('reviews').updateOne(
      { bookingCode: code },
      {
        $set: { ...clean, updatedAt: now },
        $setOnInsert: {
          bookingCode: code,
          from: String(booking.from || ''),
          to: String(booking.to || ''),
          companyName: String(booking.companyName || ''),
          travelDate: String(booking.date || ''),
          createdAt: now,
          hidden: false,
        },
      },
      { upsert: true }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not save your review, please try again' }, { status: 500 })
  }
}
