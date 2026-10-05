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
 * BusHub's social pages, shown as "Connect with us" in the footer. A link left empty is not shown.
 */
export const SOCIAL_LINKS: { facebook: string; instagram: string; youtube: string; tiktok: string } = {
  facebook: '',
  instagram: '',
  youtube: '',
  tiktok: '',
}
