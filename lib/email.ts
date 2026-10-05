/**
 * Sends email through Resend (resend.com). Needs RESEND_API_KEY, and EMAIL_FROM such as
 * "BusHub <tickets@bushubbd.com>" on a domain verified in Resend. Without them nothing is sent
 * and the caller carries on, the same way WhatsApp works.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    console.warn('Email is not set up (RESEND_API_KEY, EMAIL_FROM); skipping send')
    return false
  }
  try {
    // EMAIL_API_URL is only for testing against a stand-in server.
    const res = await fetch(process.env.EMAIL_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    })
    if (!res.ok) {
      console.error('Email send failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}
