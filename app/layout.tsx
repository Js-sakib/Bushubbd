import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import SiteChrome from './SiteChrome'
import './globals.css'

export const metadata: Metadata = {
  title: 'BusHub - Book Bus Tickets Online',
  description: 'Fast & secure bus ticket booking in Bangladesh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
      </head>
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
