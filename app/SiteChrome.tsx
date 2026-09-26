'use client'

import { usePathname } from 'next/navigation'
import Logo from './BrandLogo'

const BARE_ROUTES = ['/admin', '/company', '/verify']

/**
 * Soft colour glows fixed behind every page, the same as the admin dashboard's, so the glass
 * cards have light to catch. Decoration only; blurred once and never repainted on scroll.
 */
function Glows() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[460px] w-[460px] rounded-full bg-[#f2661d] opacity-[0.15] blur-[120px]" />
      <div className="absolute -right-40 top-[35%] h-[400px] w-[400px] rounded-full bg-[#12a594] opacity-[0.11] blur-[120px]" />
      <div className="absolute -bottom-32 left-[20%] h-[340px] w-[340px] rounded-full bg-[#6d4aff] opacity-[0.07] blur-[120px]" />
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
        <div className="glass mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <a href="/" className="flex items-center" aria-label="BusHub home">
            <Logo className="h-9 w-auto" />
          </a>
          <a
            href="/about"
            className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-[#c4cdcf] transition hover:border-[#f5a524]/50 hover:text-[#f5a524]"
          >
            About us
          </a>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl">{children}</main>

      <footer className="no-print mt-12 border-t border-white/[0.07] bg-black/30">
        <div className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-8">
          <div className="flex flex-col gap-3 sm:max-w-sm">
            <span className="display text-base font-bold">Get fare alerts</span>
            <span className="text-[12.5px] leading-snug text-[#8e9a9d]">
              New routes and seat drops, straight to your inbox.
            </span>
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input id="footer-email" type="email" placeholder="Email address" className="input-dark" />
            <button type="button" className="glass-btn glass-btn-plain h-12 text-sm">
              Subscribe
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <a href="/company/register" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              For bus operators
            </a>
            <a href="#refund" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              Refund policy
            </a>
            <a href="/about#contact" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              Contact us
            </a>
            <a href="#terms" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              Terms
            </a>
            <a href="#privacy" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              Privacy
            </a>
            <a href="/about" className="text-[13px] text-[#b7c1c3] hover:text-[#f5a524]">
              About BusHub
            </a>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Logo className="h-8 w-auto" />
            <span className="text-[11.5px] leading-relaxed text-[#78868a]">
              © {new Date().getFullYear()} BusHub · bushubbd.com. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </>
  )
}
