'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import Logo from './BrandLogo'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP, SOCIAL_LINKS } from '@/lib/site'
import { telHref } from '@/lib/phone'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** The TikTok note, drawn three times (cyan, pink, then dark) like its logo. */
const TIKTOK = 'M16.6 3c.4 2 1.7 3.4 3.9 3.6v3.1c-1.5 0-2.8-.4-3.9-1.1v6.3c0 3.3-2.6 5.6-5.6 5.6S5.5 18.2 5.5 15c0-3.4 3-5.8 6.4-5.3v3.2c-1.6-.4-3.2.6-3.2 2.2 0 1.3 1 2.3 2.3 2.3 1.4 0 2.4-1 2.4-2.6V3z'

/** BusHub's social pages, each in its own brand colour. */
const SOCIALS: { key: keyof typeof SOCIAL_LINKS; label: string; tile: string; icon: React.ReactNode }[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    tile: 'bg-[#1877F2] text-white',
    icon: <path fill="currentColor" d="M14 8.5V6.8c0-.8.5-1.3 1.4-1.3H17V2.3h-2.6C11.6 2.3 10.4 4 10.4 6.5v2H8v3.3h2.4V22H14V11.8h2.6l.4-3.3z" />,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    tile: 'bg-[radial-gradient(circle_at_30%_110%,#feda75_0%,#fa7e1e_25%,#d62976_50%,#962fbf_75%,#4f5bd5_100%)] text-white',
    icon: (
      <g {...stroke} strokeWidth={2}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
      </g>
    ),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    tile: 'border border-[#111111]/10 bg-white',
    icon: (
      <>
        <path fill="#25F4EE" d={TIKTOK} transform="translate(-0.9 -0.7)" />
        <path fill="#FE2C55" d={TIKTOK} transform="translate(0.9 0.7)" />
        <path fill="#111111" d={TIKTOK} />
      </>
    ),
  },
  {
    key: 'telegram',
    label: 'Telegram',
    tile: 'bg-[#229ED9] text-white',
    icon: <path fill="currentColor" d="M21.5 4.3 2.9 11.5c-1 .4-1 1.6 0 1.9l4.7 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.8 3.5c.6.4 1.4.1 1.6-.6L22.9 5.7c.2-1-.6-1.8-1.4-1.4zM9.8 14.6l8.3-7.3-6.6 8.6-.3 3.2z" />,
  },
]

/** A brand logo tile with its name under it. It is a link once the page's address is set in lib/site.ts. */
function SocialTile({ href, label, tile, icon }: { href: string; label: string; tile: string; icon: React.ReactNode }) {
  const inner = (
    <>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_8px_18px_rgba(0,36,71,0.14)] transition group-hover:-translate-y-0.5 ${tile}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className="text-[11.5px] font-semibold text-[#3f3f3f]">{label}</span>
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`BusHub on ${label}`} className="group flex w-16 flex-col items-center gap-1.5">
      {inner}
    </a>
  ) : (
    <span title={`BusHub on ${label}`} className="group flex w-16 flex-col items-center gap-1.5">
      {inner}
    </span>
  )
}

/** One way to reach us, with the number or address written out. */
function ContactRow({ href, title, value, tile, icon }: { href: string; title: string; value: string; tile: string; icon: React.ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-3 rounded-2xl px-1.5 py-1.5 transition hover:bg-[#111111]/[0.04]"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_14px_rgba(0,36,71,0.12)] ${tile}`}>
        <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} className="h-5 w-5" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11.5px] font-semibold text-[#4a4a4a]">{title}</span>
        <span className="truncate text-[14px] font-bold text-[#111111]">{value}</span>
      </span>
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

            <span className="mt-3 text-[12.5px] font-bold text-[#2b2b2b]">We accept · পেমেন্ট</span>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl bg-[#E2136E] px-3.5 py-2 text-[13px] font-extrabold text-white shadow-[0_6px_14px_rgba(226,19,110,0.25)]">bKash</span>
              <span className="rounded-xl bg-[#F6921E] px-3.5 py-2 text-[13px] font-extrabold text-[#1a0d03] shadow-[0_6px_14px_rgba(246,146,30,0.3)]">Nagad</span>
            </div>
            <ul className="mt-1 flex flex-col gap-2">
              {[
                ['QR ticket, checked at the bus door', 'bg-[#53d3d1]'],
                ['Your seat is held 10 minutes while you pay', 'bg-[#feb249]'],
                ['Your ticket also comes to your WhatsApp and email', 'bg-[#f9c6dc]'],
              ].map(([text, dot]) => (
                <li key={text} className="flex items-center gap-2.5 text-[12.5px] text-[#2b2b2b]">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${dot}`}>
                    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={3} className="h-3 w-3 text-[#111111]" aria-hidden>
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </form>

          <div className="flex flex-col gap-3">
            <span className="display text-[17px] font-bold">Connect with us</span>
            <span className="text-[12.5px] leading-snug text-[#4a4a4a]">
              Questions about a ticket or a refund? Message or call us. টিকেট নিয়ে প্রশ্ন? আমাদের জানান।
            </span>
            <div className="flex flex-col gap-0.5 rounded-2xl border border-[#111111]/10 bg-white/85 p-2 shadow-[0_6px_16px_rgba(0,36,71,0.06)]">
              <ContactRow
                href={`https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}`}
                title="WhatsApp"
                value={CONTACT_WHATSAPP}
                tile="bg-[#25D366]"
                icon={<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.3L3.5 20.5 5.1 16A8.4 8.4 0 1 1 20.5 11.6z" />}
              />
              <ContactRow
                href={telHref(CONTACT_PHONE)}
                title="Call us · কল করুন"
                value={CONTACT_PHONE}
                tile="bg-gradient-to-br from-[#feb249] to-[#f2661d]"
                icon={<path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />}
              />
              <ContactRow
                href={`mailto:${CONTACT_EMAIL}`}
                title="Email"
                value={CONTACT_EMAIL}
                tile="bg-[#53d3d1]"
                icon={
                  <>
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m4 7 8 6 8-6" />
                  </>
                }
              />
            </div>
            <span className="mt-1 text-[12.5px] font-bold text-[#2b2b2b]">Follow us · আমাদের সাথে থাকুন</span>
            <div className="flex flex-wrap gap-3">
              {SOCIALS.map((s) => (
                <SocialTile key={s.key} href={SOCIAL_LINKS[s.key]} label={s.label} tile={s.tile} icon={s.icon} />
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
                <span className="text-[12px] text-[#4a4a4a]">We send it again to your WhatsApp or email</span>
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
