import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { formatTripDate } from '@/lib/dates'
import { MAX_SEATS_PER_BOOKING } from '@/lib/seats'
import { dhakaDate } from '@/lib/scan'
import { banglaCity, routeFromSlug, routePath } from '@/lib/routes'
import { indexableRoutes, loadPublicPlaces, upcomingTrips, type RouteTrip } from '@/lib/routeStats'
import { CONTACT_WHATSAPP, SITE_URL } from '@/lib/site'
import JsonLd from '../JsonLd'

// Rebuilt at most every 10 minutes, so fares and seat counts stay close to live without a
// database query on every visit.
export const revalidate = 600

// Pages are made on first visit and then cached, rather than all at build time.
export async function generateStaticParams() {
  return []
}

const loadRoute = cache(async (slug: string) => {
  const { db, places } = await loadPublicPlaces()
  const route = routeFromSlug(slug, places.cities)
  if (!route) return null
  const trips: RouteTrip[] = db ? await upcomingTrips(db, route.from, route.to).catch(() => []) : []
  const listed = await indexableRoutes(db, places)
  const indexable = trips.length > 0 || listed.some((r) => r.from === route.from && r.to === route.to)
  const others = listed.filter((r) => !(r.from === route.from && r.to === route.to)).slice(0, 8)
  const reverseExists = places.cities.includes(route.to) && places.cities.includes(route.from)
  return { ...route, trips, indexable, others, reverseExists }
})

function taka(n: number): string {
  return `৳${n.toLocaleString('en-US')}`
}

function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function banglaTitle(from: string, to: string): string | null {
  const bf = banglaCity(from)
  const bt = banglaCity(to)
  return bf && bt ? `${bf} থেকে ${bt} বাসের টিকেট` : null
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadRoute(params.slug)
  if (!data) return { title: 'Route not found', robots: { index: false } }
  const { from, to, trips } = data
  const cheapest = trips.length ? Math.min(...trips.map((t) => t.price)) : 0
  const bn = banglaTitle(from, to)
  const title = `${from} to ${to} Bus Ticket – Fare & Schedule`
  const description =
    `Buy ${from} to ${to} bus tickets online${cheapest ? ` from ${taka(cheapest)}` : ''}. ` +
    `Choose your seat, pay with bKash or Nagad and get a QR ticket on WhatsApp. No line, no serial.` +
    (bn ? ` ${bn} অনলাইনে।` : '')
  const url = routePath(from, to)
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: data.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${title} | BusHub`, description, url, type: 'website' },
  }
}

export default async function RoutePage({ params }: { params: { slug: string } }) {
  const data = await loadRoute(params.slug)
  if (!data) notFound()
  const { from, to, trips, others, reverseExists } = data

  const today = dhakaDate()
  const bn = banglaTitle(from, to)
  const prices = trips.map((t) => t.price).filter((p) => p > 0)
  const cheapest = prices.length ? Math.min(...prices) : 0
  const dearest = prices.length ? Math.max(...prices) : 0
  const operators = Array.from(new Set(trips.map((t) => t.companyName).filter(Boolean)))
  const searchHref = (date: string) =>
    `/search?${new URLSearchParams({ from, to, date, passengers: '1' })}`
  const whatsapp = `https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}`

  const faqs = [
    {
      q: `How much is a ${from} to ${to} bus ticket?`,
      a: cheapest
        ? `Fares on BusHub for ${from} to ${to} currently start at ${taka(cheapest)}${
            dearest > cheapest ? ` and go up to ${taka(dearest)}` : ''
          } per seat, depending on the operator and bus type. The fare you see is the fare you pay.`
        : `Fares depend on the operator and the bus type (AC or Non-AC). Search your travel date to see every bus and its real fare.`,
    },
    {
      q: 'Can I choose my own seat?',
      a: 'Yes. You pick your seat on the live seat map. Seats that are already sold or held are shown as taken, so the seat you choose is really yours.',
    },
    {
      q: 'How do I pay?',
      a: 'You pay with bKash or Nagad. You do not need an account or a password to book.',
    },
    {
      q: 'Do I need to print the ticket?',
      a: 'No. Your QR ticket comes to WhatsApp and stays on this site. Show it on your phone when you board; the conductor scans it.',
    },
    {
      q: 'Can I book seats for my family or a group?',
      a: `Yes. You can book up to ${MAX_SEATS_PER_BOOKING} seats together in one booking, on one ticket.`,
    },
  ]

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Bus routes', item: `${SITE_URL}/routes` },
      { '@type': 'ListItem', position: 3, name: `${from} to ${to}`, item: `${SITE_URL}${routePath(from, to)}` },
    ],
  }
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  return (
    <div className="px-5 pb-6 pt-5">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqData} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#959488]">
        <a href="/" className="hover:text-[#d99d78]">Home</a>
        <span aria-hidden>›</span>
        <a href="/routes" className="hover:text-[#d99d78]">Bus routes</a>
        <span aria-hidden>›</span>
        <span className="text-[#cfc8bc]">
          {from} to {to}
        </span>
      </nav>

      <section className="mt-4 flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d99d78]">Bus route</span>
        <h1 className="text-[32px] font-bold leading-[1.1] sm:text-[42px]">
          {from} to {to} bus tickets
        </h1>
        {bn && <p className="text-[17px] font-semibold text-[#d6dcdd]">{bn}</p>}
        <p className="max-w-lg text-sm leading-relaxed text-[#b8b2a6]">
          Book your {from} to {to} bus ticket from home. Compare buses, pick your seat on the live seat map, pay with
          bKash or Nagad and get a QR ticket on WhatsApp. No counter, no line, no serial.
        </p>
      </section>

      {trips.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:max-w-xl">
          <div className="flex flex-col gap-1 glass-lite p-3">
            <span className="label-xs">Fares from</span>
            <span className="text-lg font-bold text-[#d99d78]">{taka(cheapest)}</span>
          </div>
          <div className="flex flex-col gap-1 glass-lite p-3">
            <span className="label-xs">Upcoming trips</span>
            <span className="text-lg font-bold">{trips.length}</span>
          </div>
          <div className="flex flex-col gap-1 glass-lite p-3">
            <span className="label-xs">Operators</span>
            <span className="text-lg font-bold">{operators.length}</span>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <a href={searchHref(today)} className="glass-btn h-12 px-5 text-sm">
          <span className="icon-disc h-6 w-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" className="h-3 w-3">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </span>
          See today&apos;s buses
        </a>
        {reverseExists && (
          <a href={routePath(to, from)} className="glass-btn glass-btn-plain h-12 px-5 text-sm">
            Return: {to} to {from}
          </a>
        )}
      </div>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">
          Upcoming buses from {from} to {to}
        </h2>
        {trips.length === 0 ? (
          <div className="flex flex-col gap-2 glass-lite p-4">
            <p className="text-[13px] leading-relaxed text-[#cfc8bc]">
              No trips are on sale for this route right now. New buses are added often, so check again soon, or message
              us and we will tell you when seats open.
            </p>
            <a href={whatsapp} className="text-sm font-bold text-[#2dd4bf] hover:underline">
              WhatsApp {CONTACT_WHATSAPP}
            </a>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {trips.map((trip) => (
              <li key={trip.id}>
                <a
                  href={searchHref(trip.date)}
                  className="flex items-center justify-between gap-3 glass-lite p-3.5 transition hover:border-[#cc8b65]"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-bold">{trip.busName}</span>
                    <span className="text-[12px] text-[#b8b2a6]">
                      {trip.companyName}
                      {trip.busType ? ` · ${trip.busType}` : ''}
                    </span>
                    <span className="text-[12px] text-[#cfc8bc]">
                      {formatTripDate(trip.date)} · {clock(trip.departureTime)}
                      {trip.arrivalTime ? ` → ${clock(trip.arrivalTime)}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-base font-bold text-[#d99d78]">{taka(trip.price)}</span>
                    <span className={`text-[11.5px] ${trip.seatsLeft > 0 ? 'text-[#2dd4bf]' : 'text-[#959488]'}`}>
                      {trip.seatsLeft > 0 ? `${trip.seatsLeft} seats left` : 'Sold out'}
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">How to book</h2>
        <ol className="grid gap-2.5 sm:grid-cols-3">
          {[
            { t: 'Search your date', b: `Choose ${from} to ${to} and your travel date to see every bus and its fare.` },
            { t: 'Pick your seat', b: 'Tap the seats you want on the live map and enter the passenger name and phone.' },
            { t: 'Pay and travel', b: 'Pay with bKash or Nagad. Your QR ticket arrives on WhatsApp straight away.' },
          ].map((step, i) => (
            <li key={step.t} className="flex flex-col gap-2 glass-lite p-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5a524]/[0.14] text-sm font-bold text-[#d99d78]">
                {i + 1}
              </span>
              <span className="text-sm font-bold">{step.t}</span>
              <span className="text-[12.5px] leading-relaxed text-[#b8b2a6]">{step.b}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Questions people ask</h2>
        <div className="flex flex-col gap-2">
          {faqs.map((f) => (
            <details key={f.q} className="group glass-lite p-3.5">
              <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span aria-hidden className="text-[#d99d78] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#b8b2a6]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section className="mt-8 flex flex-col gap-3">
          <h2 className="text-[17px] font-bold">Other bus routes</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {others.map((r) => (
              <a
                key={`${r.from}-${r.to}`}
                href={routePath(r.from, r.to)}
                className="flex flex-col gap-1 glass-lite p-3.5 transition hover:border-[#cc8b65]"
              >
                <span className="text-sm font-bold">
                  {r.from} → {r.to}
                </span>
                <span className="text-xs text-[#b8b2a6]">{r.minPrice ? `From ${taka(r.minPrice)}` : 'See buses'}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
