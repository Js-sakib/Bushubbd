'use client'

import { usePathname } from 'next/navigation'

const BARE_ROUTES = ['/admin', '/company', '/verify']

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route))

  if (bare) {
    return <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
  }

  return (
    <>
      <nav className="border-b border-[#1a2123] bg-[#0b0e0f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <a href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="BusHub" className="h-9 w-9 object-contain" />
            <span className="display text-xl font-bold">BusHub</span>
          </a>
          <a href="/about" className="text-xs font-semibold text-[#78868a] hover:text-[#f5a524]">
            About us
          </a>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl">{children}</main>

      <footer className="mt-12 border-t border-[#1a2123] bg-[#070a0b]">
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

          <div className="flex items-center justify-between border-t border-[#171e1f] pt-5">
            <span className="text-[11.5px] text-[#78868a]">© 2026 BusHubBD</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain opacity-75" />
          </div>
        </div>
      </footer>
    </>
  )
}
