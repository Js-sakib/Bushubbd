'use client'

import { channelFromReferrer, cleanTag } from './attribution'

/**
 * Marketing measurement in the browser: the steps of a purchase sent to Google Analytics and the
 * Facebook Pixel (only when the site has them, app/Tracking.tsx), and the channel a visitor came
 * from, remembered so the booking can say which marketing sold it. No name, phone number or email
 * is ever sent to either.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

type Step =
  | { name: 'search'; from: string; to: string }
  | { name: 'view_seats'; from: string; to: string; price: number }
  | { name: 'begin_checkout'; value: number; seats: number }
  | { name: 'purchase'; ticket: string; value: number; seats: number }

/** Sends one step of a purchase to whichever of Google Analytics and the Facebook Pixel is on. */
export function track(step: Step) {
  if (typeof window === 'undefined') return
  const { gtag, fbq } = window
  try {
    switch (step.name) {
      case 'search': {
        const route = `${step.from} → ${step.to}`
        gtag?.('event', 'search', { search_term: route })
        fbq?.('track', 'Search', { search_string: route })
        break
      }
      case 'view_seats': {
        const route = `${step.from} → ${step.to}`
        gtag?.('event', 'view_item', { currency: 'BDT', value: step.price, items: [{ item_name: route, price: step.price }] })
        fbq?.('track', 'ViewContent', { content_name: route, value: step.price, currency: 'BDT' })
        break
      }
      case 'begin_checkout':
        gtag?.('event', 'begin_checkout', { currency: 'BDT', value: step.value, items: [{ item_name: 'Bus seat', quantity: step.seats }] })
        fbq?.('track', 'InitiateCheckout', { value: step.value, currency: 'BDT', num_items: step.seats })
        break
      case 'purchase':
        gtag?.('event', 'purchase', {
          transaction_id: step.ticket,
          currency: 'BDT',
          value: step.value,
          items: [{ item_name: 'Bus seat', quantity: step.seats }],
        })
        // eventID lets Facebook drop the same purchase if it is ever reported twice.
        fbq?.('track', 'Purchase', { value: step.value, currency: 'BDT', num_items: step.seats }, { eventID: step.ticket })
        break
    }
  } catch {
    // A blocked or half-loaded tracker must never get in the way of buying a ticket.
  }
}

/** Reports a paid ticket as a purchase once per phone, so reloading the ticket page doesn't count it again. */
export function trackPurchaseOnce(ticket: string, value: number, seats: number) {
  const key = `bushub.tracked.${ticket}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {
    // Storage blocked: report it anyway; Facebook drops a repeat by its eventID.
  }
  track({ name: 'purchase', ticket, value, seats })
}

const SOURCE_KEY = 'bushub.source'
/** A visit counts towards the channel that brought it for this long. */
const SOURCE_DAYS = 30

interface SavedSource {
  channel: string
  campaign?: string
  at: number
}

/**
 * Remembers the channel of this visit: a link's utm_source/utm_campaign first, else the site the
 * visitor came from. A newer channel replaces an older one (the ad that brought them back gets the
 * credit); a visit with neither keeps what was saved.
 */
export function rememberSource() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const channel =
      cleanTag(params.get('utm_source')) ?? (document.referrer ? channelFromReferrer(document.referrer, window.location.hostname) : undefined)
    if (!channel) return
    const saved: SavedSource = { channel, at: Date.now() }
    const campaign = cleanTag(params.get('utm_campaign'), 60)
    if (campaign) saved.campaign = campaign
    localStorage.setItem(SOURCE_KEY, JSON.stringify(saved))
  } catch {
    // Private mode or storage blocked: the booking is simply counted as direct.
  }
}

/** The channel and campaign to file this visitor's booking under, when one is still current. */
export function currentSource(): { channel?: string; campaign?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const saved = JSON.parse(localStorage.getItem(SOURCE_KEY) || 'null') as SavedSource | null
    if (!saved?.channel || Date.now() - saved.at > SOURCE_DAYS * 86_400_000) return {}
    return { channel: saved.channel, campaign: saved.campaign }
  } catch {
    return {}
  }
}
