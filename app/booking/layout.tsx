import type { Metadata } from 'next'

// Private to one passenger or to staff: kept out of search results.
export const metadata: Metadata = { title: 'Book your seat', robots: { index: false, follow: false } }

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children
}
