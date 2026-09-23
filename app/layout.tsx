import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import SiteChrome from './SiteChrome'
import './globals.css'

// Self-hosted at build time. Besides being faster than the Google CDN, it keeps the fonts
// same-origin so the ticket can be rendered to an image with its real typeface.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BusHub - Book Bus Tickets Online',
  description: 'Fast & secure bus ticket booking in Bangladesh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body>
        <SiteChrome>{children}</SiteChrome>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#151b1d', color: '#f6f4ef', border: '1px solid #2a3437' },
          }}
        />
      </body>
    </html>
  )
}
