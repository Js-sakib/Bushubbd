/**
 * Passenger reviews. One per ticket: a passenger who opens their paid ticket can rate the trip,
 * and change their rating later. They show on the home page unless the admin hides one.
 */
export interface Review {
  _id?: string
  /** The ticket it belongs to; one review per ticket. */
  bookingCode: string
  /** The name the passenger chose to show (their first name by default). */
  name: string
  rating: number
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
export type PublicReview = Pick<Review, 'name' | 'rating' | 'text' | 'from' | 'to' | 'companyName' | 'travelDate' | 'createdAt'> & { id: string }

export function toPublicReview(r: Review & { _id?: unknown }): PublicReview {
  return {
    id: String(r._id ?? ''),
    name: r.name,
    rating: r.rating,
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
export function cleanReview(body: unknown): { rating: number; text: string; name: string } | { error: string } {
  const input = (body || {}) as Record<string, unknown>
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose 1 to 5 stars' }
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
  return { rating, text, name }
}
