'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { rememberSource } from '@/lib/track'

/**
 * Visitor measurement for marketing. Vercel Analytics counts visitors, pages, countries and
 * devices once it is switched on in the Vercel project. Google Analytics and the Facebook Pixel
 * load only when their IDs are set (NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_META_PIXEL_ID); both follow
 * page changes on their own. The IDs are checked so nothing else can be slipped into the page.
 */
const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(process.env.NEXT_PUBLIC_GA_ID || '') ? process.env.NEXT_PUBLIC_GA_ID : ''
const PIXEL_ID = /^\d{6,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID || '') ? process.env.NEXT_PUBLIC_META_PIXEL_ID : ''

export default function Tracking() {
  useEffect(() => {
    rememberSource()
  }, [])

  return (
    <>
      <Analytics />
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  )
}
