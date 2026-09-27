import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * Private pages (tickets, bookings, the admin and operator panels) carry their own noindex tag.
 * They are left crawlable so search engines can read that tag; only the API is off limits.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
