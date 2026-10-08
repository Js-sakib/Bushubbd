'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { CHANNEL_LABELS, cleanTag } from '@/lib/attribution'
import { SITE_URL } from '@/lib/site'
import { taka } from '@/lib/tripMoney'

interface Totals {
  tickets: number
  seats: number
  sales: number
  commission: number
}
interface ChannelRow extends Totals {
  channel: string
  campaigns: (Totals & { campaign: string })[]
}

const PERIODS = [7, 30, 90]
const label = (channel: string) => CHANNEL_LABELS[channel] ?? channel.replace(/[_-]/g, ' ')

/**
 * The admin dashboard's marketing view: which channel sold the online tickets (paid, not
 * refunded) over the last 7, 30 or 90 days, and a maker for tracked links and QR codes, so an ad,
 * a vlogger or a poster at a counter can each be counted.
 */
export default function MarketingPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<{ total: Totals; channels: ChannelRow[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/marketing?days=${days}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d.channels ? d : { total: { tickets: 0, seats: 0, sales: 0, commission: 0 }, channels: [] }))
      .catch(() => !cancelled && setData({ total: { tickets: 0, seats: 0, sales: 0, commission: 0 }, channels: [] }))
    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="glass flex flex-col gap-3.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="display text-[16px] font-bold">Where buyers come from</span>
            <span className="text-[12px] text-[#4a4a4a]">Online tickets sold, by the marketing that brought the buyer.</span>
          </div>
          <div className="flex gap-1 rounded-full bg-white/70 p-1" role="group" aria-label="Period">
            {PERIODS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`h-8 rounded-full px-3 text-[12px] font-bold ${days === d ? 'bg-[#111111] text-white' : 'text-[#3f3f3f]'}`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {!data ? (
          <p className="text-[13px] text-[#4a4a4a]">Loading…</p>
        ) : data.channels.length === 0 ? (
          <p className="rounded-2xl bg-white/50 p-4 text-[13px] text-[#4a4a4a]">
            No online tickets sold in the last {days} days yet. Share a tracked link (right) in an ad, a post or on a poster, and its
            sales show here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Tickets', String(data.total.tickets)],
                ['Sales', taka(data.total.sales)],
                ['Our commission', taka(data.total.commission)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col rounded-2xl bg-white/70 p-3">
                  <span className="text-[11.5px] text-[#4a4a4a]">{k}</span>
                  <span className="text-[18px] font-extrabold">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {data.channels.map((c) => {
                const share = data.total.tickets ? c.tickets / data.total.tickets : 0
                return (
                  <div key={c.channel} className="flex flex-col gap-1.5 rounded-2xl border border-[#111111]/10 bg-white/70 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-[14px] font-bold capitalize">{label(c.channel)}</span>
                      <span className="text-[12.5px] text-[#3f3f3f]">
                        {c.tickets} ticket{c.tickets === 1 ? '' : 's'} · {c.seats} seat{c.seats === 1 ? '' : 's'} · {taka(c.sales)}
                      </span>
                      <span className="ml-auto text-[12.5px] font-bold">{Math.round(share * 100)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#111111]/[0.07]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#feb249] to-[#f2661d]" style={{ width: `${Math.max(2, share * 100)}%` }} />
                    </div>
                    {c.campaigns.length > 0 && (
                      <span className="text-[11.5px] text-[#4a4a4a]">
                        {c.campaigns.map((k) => `${k.campaign}: ${k.tickets}`).join(' · ')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        <p className="text-[11.5px] text-[#555555]">
          Visitors, cities and phones: Vercel → Analytics. Ad results: Facebook Ads Manager and Google Analytics.
        </p>
      </div>

      <LinkMaker />
    </section>
  )
}

/** Builds a tracked link (and its QR code) for one ad, post, vlogger or counter poster. */
function LinkMaker() {
  const [source, setSource] = useState('')
  const [campaign, setCampaign] = useState('')
  const [qr, setQr] = useState('')

  const tag = cleanTag(source)
  const camp = cleanTag(campaign, 60)
  const link = tag ? `${SITE_URL}/?${new URLSearchParams({ utm_source: tag, ...(camp ? { utm_campaign: camp } : {}) })}` : ''

  useEffect(() => {
    if (!link) {
      setQr('')
      return
    }
    QRCode.toDataURL(link, { width: 480, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [link])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — press and hold the link to copy it')
    }
  }

  return (
    <div className="glass flex h-fit flex-col gap-3 p-4 sm:p-5">
      <span className="display text-[16px] font-bold">Make a tracked link</span>
      <span className="text-[12px] text-[#4a4a4a]">
        Give every ad, vlogger and counter poster its own link. Tickets bought through it show up under “Where buyers come from”.
      </span>
      <label className="flex flex-col gap-1 text-[12px] font-bold">
        Where it will be shared
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="facebook, tiktok, counter_sayedabad…"
          className="input-dark text-[13.5px] font-normal"
          maxLength={40}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-bold">
        Campaign name (optional)
        <input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="eid_2026, student_offer…"
          className="input-dark text-[13.5px] font-normal"
          maxLength={60}
        />
      </label>
      {link && (
        <>
          <span className="break-all rounded-2xl bg-white/70 p-3 text-[12.5px]">{link}</span>
          <button type="button" onClick={copy} className="glass-btn h-10 text-[13px]">
            Copy link
          </button>
          {qr && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code for ${link}`} className="mx-auto h-44 w-44 rounded-xl bg-white p-1" />
              <a href={qr} download={`BusHub-QR-${tag}${camp ? `-${camp}` : ''}.png`} className="glass-btn glass-btn-plain flex h-10 items-center justify-center text-[13px]">
                Download QR for posters
              </a>
            </>
          )}
        </>
      )}
    </div>
  )
}
