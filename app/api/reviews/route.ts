import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { ObjectId, type Db } from 'mongodb'
import { PUBLIC_REVIEW_LIMIT, Review, cleanReview, toPublicReview } from '@/lib/reviews'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const CODE = /^[A-Z0-9-]{6,40}$/
/** How many reviews the Reviews page loads at a time. */
const PAGE = 20
const VISIBLE = { hidden: { $ne: true } }
/** The bus company's stars; an older review's one rating counts for both. */
const COMPANY_STARS = { $ifNull: ['$companyRating', '$rating'] }

/** BusHub's average and star breakdown, and each bus company's own average. No combined score. */
async function ratings(db: Db) {
  const [bushub, byStar, companies] = await Promise.all([
    db
      .collection<Review>('reviews')
      .aggregate<{ count: number; average: number }>([{ $match: VISIBLE }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }])
      .toArray(),
    db
      .collection<Review>('reviews')
      .aggregate<{ _id: number; count: number }>([{ $match: VISIBLE }, { $group: { _id: '$rating', count: { $sum: 1 } } }])
      .toArray(),
    db
      .collection<Review>('reviews')
      .aggregate<{ _id: string; count: number; average: number }>([
        { $match: { ...VISIBLE, companyName: { $nin: [null, ''] } } },
        { $group: { _id: '$companyName', count: { $sum: 1 }, average: { $avg: COMPANY_STARS } } },
        { $sort: { average: -1, count: -1 } },
      ])
      .toArray(),
  ])
  const round = (n: number) => Math.round(n * 10) / 10
  const stars = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: byStar.find((s) => s._id === n)?.count || 0 }))
  return {
    bushub: { average: bushub[0] ? round(bushub[0].average) : 0, count: bushub[0]?.count || 0, stars },
    companies: companies.map((c) => ({ name: c._id, average: round(c.average), count: c.count })),
  }
}

/**
 * GET with no query: the reviews the home page shows, newest first, with the ratings.
 * GET ?bookingCode=…: that ticket's own review, so its holder can see or change it.
 * GET ?list=1[&company=&route=From→To&before=]: the Reviews page, 20 at a time, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const params = req.nextUrl.searchParams
    const code = (params.get('bookingCode') || '').trim().toUpperCase()
    if (code) {
      if (!CODE.test(code)) return NextResponse.json({ review: null })
      const review = await db.collection<Review>('reviews').findOne({ bookingCode: code })
      return NextResponse.json({
        review: review ? { name: review.name, rating: review.rating, companyRating: review.companyRating ?? null, text: review.text, hidden: review.hidden } : null,
      })
    }

    if (params.get('list')) {
      const filter: Record<string, unknown> = { ...VISIBLE }
      const company = (params.get('company') || '').slice(0, 120)
      if (company) filter.companyName = company
      const route = (params.get('route') || '').slice(0, 120)
      if (route.includes('→')) {
        const [from, to] = route.split('→')
        filter.from = from
        filter.to = to
      }
      // The cursor is the last review's time and id, so "Load more" never repeats or skips one.
      const [beforeAt, beforeId] = (params.get('before') || '').split('|')
      if (beforeAt && beforeId && ObjectId.isValid(beforeId)) {
        filter.$or = [{ createdAt: { $lt: beforeAt } }, { createdAt: beforeAt, _id: { $lt: new ObjectId(beforeId) } }]
      }
      const [found, summary, routes] = await Promise.all([
        db.collection<Review>('reviews').find(filter).sort({ createdAt: -1, _id: -1 }).limit(PAGE + 1).toArray(),
        ratings(db),
        db
          .collection<Review>('reviews')
          .aggregate<{ _id: { from: string; to: string } }>([
            { $match: VISIBLE },
            { $group: { _id: { from: '$from', to: '$to' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 60 },
          ])
          .toArray(),
      ])
      const page = found.slice(0, PAGE)
      const last = page[page.length - 1]
      return NextResponse.json({
        reviews: page.map(toPublicReview),
        next: found.length > PAGE && last ? `${last.createdAt}|${String(last._id)}` : null,
        summary,
        routes: routes.filter((r) => r._id.from && r._id.to).map((r) => `${r._id.from}→${r._id.to}`),
      })
    }

    const [reviews, summary] = await Promise.all([
      db.collection<Review>('reviews').find(VISIBLE).sort({ createdAt: -1 }).limit(PUBLIC_REVIEW_LIMIT).toArray(),
      ratings(db),
    ])
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
