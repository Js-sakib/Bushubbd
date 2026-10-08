/**
 * The site's one public address. Search engines are told every page lives under this host
 * (bushubbd.com redirects here), so the preview and vercel.app copies never compete with it.
 */
export const SITE_URL = 'https://www.bushubbd.com'
export const SITE_NAME = 'BusHub'
export const CONTACT_PHONE = '+880 1603-071236'
export const CONTACT_WHATSAPP = '+971 52 146 4698'
export const CONTACT_EMAIL = 'info@bushubbd.com'

/**
 * Whether customers can buy tickets on the website. Off until a payment gateway confirms each
 * payment on the server: while off, the site shows buses and free seats, and people book by
 * calling or WhatsApp. Turned on in Vercel (NEXT_PUBLIC_ONLINE_SALES=on) with the gateway.
 */
export const ONLINE_SALES_OPEN = process.env.NEXT_PUBLIC_ONLINE_SALES === 'on'
export const SALES_PAUSED_MESSAGE = 'Online booking opens soon. Call or WhatsApp us to book your seat.'

/** A WhatsApp chat with BusHub, with a message already typed. */
export function whatsappChat(text: string): string {
  return `https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

/**
 * BusHub's social pages, shown under "Follow us" in the footer. Each logo shows either way; it
 * becomes a link once its page address is filled in here.
 */
export const SOCIAL_LINKS: { facebook: string; instagram: string; tiktok: string; telegram: string } = {
  facebook: '',
  instagram: '',
  tiktok: '',
  telegram: '',
}
