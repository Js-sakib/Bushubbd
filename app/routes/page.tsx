import type { Metadata } from 'next'
import { banglaCity, routePath } from '@/lib/routes'
import { indexableRoutes, loadPublicPlaces } from '@/lib/routeStats'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Bus Routes in Bangladesh – Online Bus Tickets',
  description:
    'Every bus route on BusHub: Dhaka, Chittagong, Sylhet, Cox’s Bazar and more. Pick your seat, pay with bKash or Nagad, get a QR ticket on WhatsApp. বাসের রুট ও টিকেট।',
  alternates: { canonical: '/routes' },
}

export default async function RoutesIndex() {
  const { db, places } = await loadPublicPlaces()
  const routes = await indexableRoutes(db, places)

  // Grouped by the city people leave from, in the admin's city order.
  const groups = places.cities
    .map((city) => ({ city, routes: routes.filter((r) => r.from === city) }))
    .filter((g) => g.routes.length > 0)

  return (
    <div className="px-5 pb-6 pt-5">
      <section className="flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#53d3d1]">Bus routes</span>
        <h1 className="text-[32px] font-bold leading-[1.1] sm:text-[42px]">Bus routes across Bangladesh</h1>
        <p className="text-[17px] font-semibold text-[#d6dcdd]">বাংলাদেশের বাস রুট · অনলাইনে টিকেট</p>
        <p className="max-w-lg text-sm leading-relaxed text-[#b8b2a6]">
          Choose a route to see its buses, fares and seats. Book from home, pay with bKash or Nagad, and get a QR ticket
          on WhatsApp.
        </p>
      </section>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-[#b8b2a6]">Routes are being added. Check back soon.</p>
      ) : (
        groups.map((group) => (
          <section key={group.city} className="mt-8 flex flex-col gap-3">
            <h2 className="text-[17px] font-bold">
              From {group.city}
              {banglaCity(group.city) && (
                <span className="ml-2 text-[14px] font-semibold text-[#aaa598]">{banglaCity(group.city)} থেকে</span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {group.routes.map((r) => (
                <a
                  key={`${r.from}-${r.to}`}
                  href={routePath(r.from, r.to)}
                  className="flex flex-col gap-1 glass-lite p-3.5 transition hover:border-[#cc8b65]"
                >
                  <span className="text-sm font-bold">
                    {r.from} → {r.to}
                  </span>
                  <span className="text-xs text-[#b8b2a6]">
                    {r.minPrice ? `From ৳${r.minPrice.toLocaleString('en-US')}` : 'See buses'}
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
