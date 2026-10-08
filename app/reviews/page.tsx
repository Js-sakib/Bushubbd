import type { Metadata } from 'next'
import ReviewsPage from './ReviewsPage'

export const metadata: Metadata = {
  title: { absolute: 'Passenger reviews — BusHub and bus companies' },
  description:
    'What real passengers say about BusHub and the bus companies they travelled with. Only paid ticket holders can review, so every review is from a real trip.',
  alternates: { canonical: '/reviews' },
}

export default function Page() {
  return <ReviewsPage />
}
