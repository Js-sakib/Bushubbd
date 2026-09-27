import type { Metadata } from 'next'

// One page per search would flood search engines with near-copies; the route pages are the
// ones meant to be found, and links from here still count.
export const metadata: Metadata = {
  title: 'Search buses',
  robots: { index: false, follow: true },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
