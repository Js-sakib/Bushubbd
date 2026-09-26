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
  metadataBase: new URL('https://bushubbd.com'),
  title: 'BusHub - Book Bus Tickets Online',
  description: 'Buy bus tickets from home in Bangladesh: pick your seat, pay with bKash or Nagad, get a QR ticket on WhatsApp.',
  openGraph: {
    title: 'BusHub - Bus tickets, now online',
    description: 'Pick your seat, pay with bKash or Nagad, and get a QR ticket on WhatsApp. No line, no serial.',
    url: 'https://bushubbd.com',
    siteName: 'BusHub',
    locale: 'en_BD',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
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
