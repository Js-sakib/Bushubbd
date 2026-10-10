import QRCode from 'qrcode'
import { randomInt } from 'crypto'
import { SITE_URL } from './site'
export { ticketExpiry } from './scan'

// No 0/O or 1/I, so a code read out or typed by hand can't be mixed up.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 10

/**
 * A ticket code like BH-20260925-7QK2MX4PHN. The random part comes from the system's secure
 * random source, so codes can't be guessed from one another: ten characters from 32 give about
 * a thousand million million codes a day. Tickets from before have five characters and still work. The database's unique index is what
 * finally guarantees no two tickets share a code; callers retry on the rare clash.
 */
export function generateBookingCode(now = new Date(), prefix: 'BH' | 'CT' = 'BH'): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
  return `${prefix}-${datePart}-${randomPart}`
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
  return process.env.NEXT_PUBLIC_BASE_URL || SITE_URL
}

export function getVerifyUrl(bookingCode: string): string {
  return `${getBaseUrl()}/verify/${bookingCode}`
}
