'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { adminPath } from '@/lib/panelNav'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import type { SalesSummary } from '@/lib/stats'
import { DEFAULT_PLACES, type Places } from '@/lib/places'
import Overview from './Overview'
import BookingsSection from './BookingsSection'
import BusesSection from './BusesSection'
import CompaniesSection from './CompaniesSection'
import LeadsSection, { isDue } from './LeadsSection'
import type { Booking, Bus, CompanyPrefill, CompanyRow, FleetBus, LeadRow, Section } from './types'
import { LogoMark } from '../BrandLogo'

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
        <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
      </svg>
    ),
  },
  {
    key: 'buses',
    label: 'Buses',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
        <rect x="3" y="4" width="18" height="12.5" rx="3" />
        <path d="M3 11h18" />
        <circle cx="7.5" cy="19" r="1.6" />
        <circle cx="16.5" cy="19" r="1.6" />
      </svg>
    ),
  },
  {
    key: 'companies',
    label: 'Companies',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
        <path d="M4 20V8l6-4v16" />
        <path d="M10 20V10l10 3v7" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
  {
    key: 'leads',
    label: 'Leads',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
        <path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />
      </svg>
    ),
  },
]

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }).format(new Date()))
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f2661d] px-1 text-[10.5px] font-bold text-white shadow-[0_0_12px_rgba(242,102,29,0.6)]">
      {count}
    </span>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState<Section>('dashboard')
  const [query, setQuery] = useState('')

  const [stats, setStats] = useState<SalesSummary | null>(null)
  const [buses, setBuses] = useState<Bus[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [fleet, setFleet] = useState<FleetBus[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [places, setPlaces] = useState<Places>(DEFAULT_PLACES)
  const [companyPrefill, setCompanyPrefill] = useState<CompanyPrefill | null>(null)

  const clearPrefill = useCallback(() => setCompanyPrefill(null), [])

  const loadAll = useCallback(() => {
    fetch('/api/admin/stats').then((r) => r.json()).then((d) => !d.error && setStats(d)).catch(() => undefined)
    fetch('/api/buses').then((r) => r.json()).then((d) => setBuses(d.buses || [])).catch(() => undefined)
    fetch('/api/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || [])).catch(() => undefined)
    fetch('/api/companies').then((r) => r.json()).then((d) => setCompanies(d.companies || [])).catch(() => undefined)
    fetch('/api/fleet').then((r) => r.json()).then((d) => setFleet(d.fleet || [])).catch(() => undefined)
    fetch('/api/leads').then((r) => r.json()).then((d) => setLeads(d.leads || [])).catch(() => undefined)
    fetch('/api/places').then((r) => r.json()).then((d) => d?.cities && setPlaces(d)).catch(() => undefined)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== 'admin') {
          router.push(adminPath('/admin/login'))
          return
        }
        setChecking(false)
        loadAll()
      })
  }, [router, loadAll])

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push(adminPath('/admin/login'))
  }

  const handleRefund = async (bookingId: string) => {
    if (!confirm('Mark this ticket as refunded? The seat goes back on sale.')) return
    const res = await fetch(`/api/bookings/${bookingId}/refund`, { method: 'PATCH' })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Failed to refund')
      return
    }
    toast.success('Ticket refunded')
    loadAll()
  }

  const go = (next: Section) => {
    setSection(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (checking) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking access...</div>
  }

  const passwordRequests = companies.filter((c) => c.passwordResetRequestedAt).length
  const leadsDue = leads.filter((l) => isDue(l)).length
  const badgeFor = (key: Section) => (key === 'companies' ? passwordRequests : key === 'leads' ? leadsDue : 0)
  const title = NAV.find((n) => n.key === section)?.label ?? 'Dashboard'

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Colour glows the glass panels blur over. Decoration only. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#f2661d] opacity-[0.16] blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-[#12a594] opacity-[0.12] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-[#6d4aff] opacity-[0.08] blur-[120px]" />
      </div>

      {/* Sidebar, computers and tablets in landscape */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] p-4 lg:block">
        <div className="glass flex h-full flex-col p-4">
          <div className="flex items-center gap-2.5 px-2 pb-6 pt-2">
            <LogoMark className="h-9 w-9" />
            <div className="flex flex-col leading-tight">
              <span className="display text-[17px] font-bold">BusHub</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5a524]">Admin</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1.5">
            {NAV.map((item) => {
              const active = section === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_8px_24px_rgba(242,102,29,0.35)]'
                      : 'text-[#b7c1c3] hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="grow text-left">{item.label}</span>
                  <Badge count={badgeFor(item.key)} />
                </button>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-semibold text-[#f5a524] transition hover:bg-white/[0.06]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
              <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[256px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5 lg:px-6 lg:pt-4">
          <div className="glass flex items-center gap-3 px-4 py-3 sm:px-5">
            <LogoMark className="h-8 w-8 shrink-0 lg:hidden" />
            <div className="flex min-w-0 grow flex-col">
              <span className="display truncate text-[17px] font-bold leading-tight sm:text-[19px]">
                {section === 'dashboard' ? `${greeting()}!` : title}
              </span>
              <span className="truncate text-[11.5px] text-[#8e9a9d]">{formatTripDate(dhakaDate())}</span>
            </div>
            <div className="relative hidden w-[300px] md:block">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e7b7e]">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (section !== 'bookings') setSection('bookings')
                }}
                placeholder="Search passenger, code, route"
                aria-label="Search bookings"
                className="h-11 w-full rounded-full border border-white/10 bg-black/25 pl-10 pr-4 text-[13px] text-white placeholder:text-[#6e7b7e] focus:border-[#f5a524]/60 focus:outline-none"
              />
            </div>
            <span className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[12px] font-bold text-[#1a0d03]">A</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12.5px] font-bold">Admin</span>
                <span className="text-[10.5px] text-[#8e9a9d]">BusHub owner</span>
              </span>
            </span>
            <button type="button" onClick={handleLogout} aria-label="Log out" className="icon-btn shrink-0 lg:hidden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </header>

        <main className="px-3 pb-28 pt-4 sm:px-5 lg:px-6 lg:pb-10">
          {section === 'dashboard' && (
            <Overview stats={stats} bookings={bookings} buses={buses} onRefund={handleRefund} onSeeAllBookings={() => go('bookings')} />
          )}
          {section === 'bookings' && <BookingsSection bookings={bookings} query={query} onQuery={setQuery} onRefund={handleRefund} />}
          {section === 'buses' && <BusesSection buses={buses} bookings={bookings} companies={companies} fleet={fleet} places={places} onChanged={loadAll} />}
          {section === 'companies' && (
            <CompaniesSection companies={companies} onChanged={loadAll} prefill={companyPrefill} onPrefillUsed={clearPrefill} />
          )}
          {section === 'leads' && (
            <LeadsSection
              leads={leads}
              companies={companies}
              onChanged={loadAll}
              onCreateLogin={(lead) => {
                setCompanyPrefill({ name: lead.companyName, ownerName: lead.contactName, phone: lead.phone })
                go('companies')
              }}
            />
          )}
        </main>
      </div>

      {/* Bottom tabs, phones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="glass grid grid-cols-5 gap-1 p-1.5">
          {NAV.map((item) => {
            const active = section === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-2xl py-2 text-[10.5px] font-bold transition ${
                  active ? 'bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.4)]' : 'text-[#9ba7aa]'
                }`}
              >
                {item.icon}
                {item.label}
                {badgeFor(item.key) > 0 && (
                  <span className="absolute right-1.5 top-1">
                    <Badge count={badgeFor(item.key)} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
