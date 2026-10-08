/**
 * Where a buyer came from (Facebook ad, TikTok, a counter poster's QR, Google…), kept on the
 * booking so the admin can see which marketing actually sells tickets. Shared by the browser,
 * which reads the link and the referring site, and the booking API, which cleans what it is sent.
 */

/** Sites whose many hostnames mean one channel. */
const KNOWN_SITES: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$/, 'telegram'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/, 'search'],
]

/** Short spellings people type in links, folded into the channel they mean. */
const ALIASES: Record<string, string> = { fb: 'facebook', ig: 'instagram', insta: 'instagram', tt: 'tiktok', yt: 'youtube', wa: 'whatsapp' }

/** A channel or campaign name as stored: lower case letters, digits, - and _, at most `max` long. */
export function cleanTag(raw: unknown, max = 40): string | undefined {
  const tag = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, max)
  if (!tag) return undefined
  return ALIASES[tag] ?? tag
}

/** The channel a referring page belongs to, or undefined for our own site and unreadable links. */
export function channelFromReferrer(referrer: string, ownHost: string): string | undefined {
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return undefined
  }
  const bare = (h: string) => h.replace(/^www\./, '')
  if (!host || bare(host) === bare(ownHost.toLowerCase())) return undefined
  for (const [pattern, channel] of KNOWN_SITES) if (pattern.test(host)) return channel
  // Any other site: its name without www and the ending (prothomalo.com → prothomalo).
  return cleanTag(bare(host).split('.').slice(0, -1).join('.') || bare(host))
}

/** The channel and campaign a booking request names, cleaned; fields left out when not given. */
export function marketingTags(body: { channel?: unknown; campaign?: unknown }): { channel?: string; campaign?: string } {
  const channel = cleanTag(body?.channel)
  if (!channel) return {}
  const campaign = cleanTag(body?.campaign, 60)
  return campaign ? { channel, campaign } : { channel }
}

/** Readable names for the admin panel; anything else is shown as typed in the link. */
export const CHANNEL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  google: 'Google',
  search: 'Other search',
  direct: 'Direct / typed',
}
