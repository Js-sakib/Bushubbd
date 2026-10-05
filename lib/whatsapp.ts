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
