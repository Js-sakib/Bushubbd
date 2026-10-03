import type { Metadata } from 'next'
import { Hind_Siliguri, Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import SiteChrome from './SiteChrome'
import JsonLd from './routes/JsonLd'
import { CONTACT_PHONE, SITE_NAME, SITE_URL } from '@/lib/site'
import './globals.css'

// Self-hosted at build time. Besides being faster than the Google CDN, it keeps the fonts
// same-origin so the ticket can be rendered to an image with its real typeface.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

// Bangla on the ticket. Not preloaded: the files only download on pages that show Bangla text.
const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
  display: 'swap',
  preload: false,
})

const DESCRIPTION =
  'Buy bus tickets online in Bangladesh from home. Pick your seat, pay with bKash or Nagad and get a QR ticket on WhatsApp. No line, no serial. অনলাইনে বাসের টিকেট।'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BusHub – Buy Bus Tickets Online in Bangladesh',
    template: '%s | BusHub',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'bus ticket',
    'online bus ticket',
    'bus ticket Bangladesh',
    'bus ticket BD',
    'Dhaka bus ticket',
    'bKash bus ticket',
    'বাসের টিকেট',
    'অনলাইনে বাসের টিকেট',
    'BusHub',
    'bushubbd',
  ],
  openGraph: {
    title: 'BusHub – Bus tickets, now online',
    description: 'Pick your seat, pay with bKash or Nagad, and get a QR ticket on WhatsApp. No line, no serial.',
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_BD',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

/** Who runs the site and how to reach them, for search engines' knowledge panel and site name. */
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/bushub-mark-512.png`,
      address: { '@type': 'PostalAddress', addressLocality: 'Comilla', addressCountry: 'BD' },
      areaServed: { '@type': 'Country', name: 'Bangladesh' },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: CONTACT_PHONE.replace(/[^\d+]/g, ''),
          contactType: 'customer service',
          areaServed: 'BD',
          availableLanguage: ['Bengali', 'English'],
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ['BusHub BD', 'bushubbd.com'],
      url: `${SITE_URL}/`,
      inLanguage: ['en', 'bn'],
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${hindSiliguri.variable}`}>
      <body>
        <JsonLd data={ORGANIZATION} />
        <SiteChrome>{children}</SiteChrome>
        <Toaster
          position="top-center"
          containerClassName="no-print"
          toastOptions={{
            style: { background: '#0d3c32', color: '#f3eee6', border: '1px solid #2a5d50' },
          }}
        />
      </body>
    </html>
  )
}
