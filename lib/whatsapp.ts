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
