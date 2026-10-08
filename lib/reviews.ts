/**
 * Passenger reviews. One per ticket: a passenger who opens their paid ticket rates BusHub
 * (booking, payment, ticket) and the bus company (bus, seat, time, staff) separately, and can
 * change it later. They show on the home page and the Reviews page unless the admin hides one.
 */
export interface Review {
  _id?: string
  /** The ticket it belongs to; one review per ticket. */
  bookingCode: string
  /** The name the passenger chose to show (their first name by default). */
  name: string
  /** BusHub's rating: booking, payment, ticket. */
  rating: number
  /** The bus company's rating: bus, seat, time, staff. Reviews from before it was asked have
   * none; their one rating counts for both (see companyStars). */
  companyRating?: number
  text: string
  from: string
  to: string
  companyName: string
  travelDate: string
  createdAt: string
  updatedAt: string
  hidden: boolean
}

export const REVIEW_TEXT_MAX = 400
export const REVIEW_NAME_MAX = 40
/** How many reviews the home page can show. */
export const PUBLIC_REVIEW_LIMIT = 12

/** What anyone may see of a review: no ticket number, nothing that leads back to the passenger. */
export type PublicReview = Pick<Review, 'name' | 'rating' | 'text' | 'from' | 'to' | 'companyName' | 'travelDate' | 'createdAt'> & { id: string; companyRating: number }

/** The bus company's stars: its own rating, or the one rating an older review has. */
export function companyStars(r: Pick<Review, 'rating' | 'companyRating'>): number {
  return r.companyRating ?? r.rating
}

export function toPublicReview(r: Review & { _id?: unknown }): PublicReview {
  return {
    id: String(r._id ?? ''),
    name: r.name,
    rating: r.rating,
    companyRating: companyStars(r),
    text: r.text,
    from: r.from,
    to: r.to,
    companyName: r.companyName,
    travelDate: r.travelDate,
    createdAt: r.createdAt,
  }
}

/** The first word of the passenger's name, which is what a review shows unless they change it. */
export function firstName(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0]?.slice(0, REVIEW_NAME_MAX) || ''
}

/** Checks what the passenger typed. Returns the cleaned values, or the reason it can't be saved. */
export function cleanReview(body: unknown): { rating: number; companyRating: number; text: string; name: string } | { error: string } {
  const input = (body || {}) as Record<string, unknown>
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose 1 to 5 stars for BusHub' }
  const companyRating = Number(input.companyRating)
  if (!Number.isInteger(companyRating) || companyRating < 1 || companyRating > 5) return { error: 'Please choose 1 to 5 stars for the bus company' }
  const text = String(input.text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > REVIEW_TEXT_MAX) return { error: `Please keep your review under ${REVIEW_TEXT_MAX} letters` }
  const name = String(input.name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return { error: 'Please write the name to show' }
  if (name.length > REVIEW_NAME_MAX) return { error: `Please keep the name under ${REVIEW_NAME_MAX} letters` }
  if (/https?:|www\.|<|>/i.test(text + name)) return { error: 'Links are not allowed in reviews' }
  return { rating, companyRating, text, name }
}
