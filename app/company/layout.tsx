import type { Metadata } from 'next'

// Private to one passenger or to staff: kept out of search results.
export const metadata: Metadata = { title: 'Operator panel', robots: { index: false, follow: false } }

// The bus company pages use the light look (frosted white panels, navy text): see .light-panel.
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <div className="light-panel panel-buttons">{children}</div>
}
