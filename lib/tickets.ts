import QRCode from 'qrcode'
import { randomInt } from 'crypto'
export { ticketExpiry } from './scan'

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * A ticket code like BH-20260925-7QK2M. The random part comes from the system's secure random
 * source, so codes can't be guessed from one another. The database's unique index is what
 * finally guarantees no two tickets share a code; callers retry on the rare clash.
 */
export function generateBookingCode(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
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
