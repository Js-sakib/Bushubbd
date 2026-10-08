import type { MetadataRoute } from 'next'
import { routePath } from '@/lib/routes'
import { indexableRoutes, loadPublicPlaces } from '@/lib/routeStats'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

/** The pages search engines should know about: the public pages and every route worth a page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { db, places } = await loadPublicPlaces()
  const routes = await indexableRoutes(db, places)
  const now = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/routes`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/reviews`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ...routes.map((r) => ({
      url: `${SITE_URL}${routePath(r.from, r.to)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ]
}
