const WHATSAPP_API_VERSION = 'v18.0'

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const config = getConfig()
  if (!config) {
    console.warn('WhatsApp credentials not configured; skipping send to', to)
    return false
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    )
    if (!res.ok) {
      const errBody = await res.text()
      console.error('WhatsApp send failed:', res.status, errBody)
      return false
    }
    return true
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return false
  }
}

/**
 * Sends an approved message template. WhatsApp only lets a business start a conversation with
 * a template (a plain text message only reaches someone who wrote to us in the last 24 hours),
 * so tickets use one when WHATSAPP_TICKET_TEMPLATE names it. `params` fill {{1}}, {{2}}... in order.
 */
export async function sendWhatsAppTemplate(to: string, template: string, params: string[], language = 'en'): Promise<boolean> {
  const config = getConfig()
  if (!config) return false
  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      }),
    })
    if (!res.ok) {
      console.error('WhatsApp template send failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('WhatsApp template send error:', err)
    return false
  }
}

/** True when reset codes can go out on WhatsApp: the API is set up and WHATSAPP_OTP_TEMPLATE names an approved code template. */
export function whatsappCodeConfigured(): boolean {
  return Boolean(getConfig() && process.env.WHATSAPP_OTP_TEMPLATE)
}

/**
 * Sends a one-time code with Meta's "authentication" template (WHATSAPP_OTP_TEMPLATE), the only
 * kind WhatsApp allows for codes. Its body takes the code as {{1}} and its copy-code button
 * takes the code again.
 */
export async function sendWhatsAppCode(to: string, code: string): Promise<boolean> {
  const config = getConfig()
  const template = process.env.WHATSAPP_OTP_TEMPLATE
  if (!config || !template) return false
  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_OTP_LANGUAGE || 'en' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    })
    if (!res.ok) {
      console.error('WhatsApp code send failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('WhatsApp code send error:', err)
    return false
  }
}
