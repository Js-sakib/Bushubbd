import QRCode from 'qrcode'
export { ticketExpiry } from './scan'

export function generateBookingCode(): string {
  const date = new Date()
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `BH-${datePart}-${randomPart}`
}

export function isExpired(validUntil: string): boolean {
  return new Date(validUntil).getTime() < Date.now()
}

export function calculateHoldExpiry(minutesFromNow = 10): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString()
}

export const DEFAULT_COMMISSION_RATE = 10

export function calculateCommission(totalPrice: number, commissionRate: number) {
  const commissionAmount = Math.round(totalPrice * (commissionRate / 100))
  return { commissionAmount, companyPayout: totalPrice - commissionAmount }
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
