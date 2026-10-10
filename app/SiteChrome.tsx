'use client'

import { usePathname } from 'next/navigation'
import Logo from './BrandLogo'
import LivePurchases from './LivePurchases'
import SiteFooter from './SiteFooter'

const BARE_ROUTES = ['/admin', '/company', '/verify', '/invoice']

/**
 * Soft colour glows fixed behind every page, the same as the admin dashboard's, so the glass
 * cards have light to catch. Decoration only; blurred once and never repainted on scroll.
 */
function Glows() {
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[460px] w-[460px] rounded-full bg-[#f2661d] opacity-[0.15] blur-[120px]" />
      <div className="absolute -right-40 top-[35%] h-[400px] w-[400px] rounded-full bg-[#53d3d1] opacity-[0.12] blur-[120px]" />
      <div className="absolute -bottom-32 left-[20%] h-[340px] w-[340px] rounded-full bg-[#0dabab] opacity-[0.12] blur-[120px]" />
    </div>
  )
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route))

  // The admin dashboard lays out its own sidebar and full-width shell.
  if (pathname === '/admin' || pathname === '/admin/') {
    return <>{children}</>
  }

  if (bare) {
    return (
      <>
        <Glows />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </>
    )
  }

  return (
    <>
      <Glows />
      <nav className="no-print sticky top-0 z-40 px-3 pt-3">
        <div className="glass nav-glow mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <a href="/" className="flex items-center" aria-label="BusHub home">
            <Logo className="h-9 w-auto" tone="light" />
          </a>
          <div className="flex items-center gap-2">
            <a
              href="/tickets"
              className="rounded-full bg-gradient-to-r from-[#feb249] to-[#f2661d] px-3.5 py-1.5 text-[12px] font-bold text-[#1a0d03] shadow-[0_6px_16px_rgba(242,102,29,0.3)] transition hover:-translate-y-0.5"
            >
              My tickets
            </a>
            <a
              href="/about"
              className="rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-[#222222] transition hover:border-[#cc8b65]/50 hover:text-[#0b7f8c]"
            >
              About us
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl">{children}</main>
      <LivePurchases />

      <SiteFooter />
    </>
  )
}
