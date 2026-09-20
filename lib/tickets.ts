import QRCode from 'qrcode'

export function generateBookingCode(): string {
  const date = new Date()
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `BH-${datePart}-${randomPart}`
}

export function calculateExpiry(hoursFromNow = 24): string {
  const expiry = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  return expiry.toISOString()
}

export function isExpired(validUntil: string): boolean {
  return new Date(validUntil).getTime() < Date.now()
}

export async function generateTicketQRCode(verifyUrl: string): Promise<string> {
  return QRCode.toDataURL(verifyUrl, { width: 240, margin: 1 })
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://bushubbd.vercel.app'
}

export function getVerifyUrl(bookingCode: string): string {
  return `${getBaseUrl()}/verify/${bookingCode}`
}
