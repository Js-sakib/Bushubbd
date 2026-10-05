'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import Logo from './BrandLogo'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP, SOCIAL_LINKS } from '@/lib/site'
import { telHref } from '@/lib/phone'

const ICONS: Record<string, React.ReactNode> = {
  whatsapp: <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.3L3.5 20.5 5.1 16A8.4 8.4 0 1 1 20.5 11.6zM9 8.2c.3-.6.6-.6.9-.6h.6c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.3 0 .6.5.8 1.6 2 2.9 2.5.3.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.3.4.4 0 .6-.3 1.6-1.6 2-1 .3-2.4.1-4.4-1.2-1.9-1.3-3.2-3.3-3.5-4-.4-.8-.4-1.6-.3-2.1.1-.4.3-.8.4-1z" />,
  phone: <path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />,
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  facebook: <path d="M14.5 8H16V4.8a19 19 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4V11H7.2v3.5h2.6V21h3.2v-6.5h2.6l.4-3.5h-3v-2c0-1 .3-1.6 1.5-1.6z" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  tiktok: <path d="M14 3.5v11.2a3.3 3.3 0 1 1-2.8-3.3V8.2a6.5 6.5 0 1 0 6 6.5V9.2a7 7 0 0 0 3.6 1V7a3.8 3.8 0 0 1-3.6-3.5z" />,
}

function SocialButton({ href, label, icon }: { href: string; label: string; icon: string }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#111111]/10 bg-white text-[#0b7f8c] shadow-[0_6px_16px_rgba(0,36,71,0.08)] transition hover:-translate-y-0.5 hover:border-[#f2661d]/50 hover:text-[#f2661d]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]" aria-hidden>
        {ICONS[icon]}
      </svg>
    </a>
  )
}

/** The footer on every public page: offers sign-up, ways to reach us, and the useful links. */
export default function SiteFooter() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Could not sign you up')
        return
      }
      setDone(true)
      setEmail('')
      toast.success('You are on the list. Offers will come to your inbox.')
    } catch {
      toast.error('No internet connection. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const contacts: { href: string; label: string; icon: string }[] = [
    { href: `https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}`, label: 'WhatsApp', icon: 'whatsapp' },
    { href: telHref(CONTACT_PHONE), label: `Call ${CONTACT_PHONE}`, icon: 'phone' },
    { href: `mailto:${CONTACT_EMAIL}`, label: `Email ${CONTACT_EMAIL}`, icon: 'email' },
    ...(Object.entries(SOCIAL_LINKS) as [string, string][])
      .filter(([, url]) => url)
      .map(([key, url]) => ({ href: url, label: key.charAt(0).toUpperCase() + key.slice(1), icon: key })),
  ]

  const links = [
    { href: '/tickets', label: 'Find my ticket' },
    { href: '/routes', label: 'Bus routes' },
    { href: '/company/register', label: 'For bus operators' },
    { href: '/about#contact', label: 'Contact us' },
    { href: '/about', label: 'About BusHub' },
  ]

  return (
    <footer className="no-print mt-12 border-t border-[#111111]/10 bg-white/65">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-9">
        <div className="grid gap-8 sm:grid-cols-2">
          <form onSubmit={subscribe} className="flex flex-col gap-3">
            <span className="display text-[17px] font-bold">Subscribe to our special offers</span>
            <span className="text-[12.5px] leading-snug text-[#4a4a4a]">
              New routes, discounts and Eid seat alerts, straight to your inbox. অফার ও নতুন রুটের খবর পান।
            </span>
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input
              id="footer-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="input-dark"
            />
            <button type="submit" disabled={sending} className="glass-btn btn-orange h-12 text-sm">
              {sending ? 'Subscribing...' : done ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </form>

          <div className="flex flex-col gap-3">
            <span className="display text-[17px] font-bold">Connect with us</span>
            <span className="text-[12.5px] leading-snug text-[#4a4a4a]">Questions about a ticket? We reply on WhatsApp, phone and email.</span>
            <div className="flex flex-wrap gap-2.5">
              {contacts.map((c) => (
                <SocialButton key={c.label} {...c} />
              ))}
            </div>
            <a
              href="/tickets"
              className="mt-1 flex items-center gap-3 rounded-2xl border border-[#111111]/10 bg-white p-3.5 shadow-[0_6px_16px_rgba(0,36,71,0.06)] transition hover:border-[#f2661d]/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#feb249]/25 text-[#c2410c]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
                </svg>
              </span>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-bold">Lost your ticket?</span>
                <span className="text-[12px] text-[#4a4a4a]">Find and download it again with your mobile number</span>
              </span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#111111]/10 pt-6 sm:grid-cols-5">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[13px] text-[#2b2b2b] hover:text-[#0b7f8c]">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#111111]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="h-8 w-auto" tone="light" />
          <span className="text-[11.5px] leading-relaxed text-[#555555]">
            © {new Date().getFullYear()} BusHub · bushubbd.com. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
