import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import type { Db, ObjectId } from 'mongodb'
import { emailConfigured, sendEmail } from './email'
import { whatsappNumber } from './phone'
import { sendWhatsAppCode, whatsappCodeConfigured } from './whatsapp'

/** A reset code works for ten minutes, and only the newest one a company asked for. */
export const CODE_TTL_MS = 10 * 60 * 1000
/** Wrong codes allowed on one code before it stops working and a new one is needed. */
export const CODE_MAX_TRIES = 5
export const PASSWORD_MIN = 8
/** bcrypt ignores everything past 72 bytes, so a longer password would not mean what it says. */
export const PASSWORD_MAX_BYTES = 72
/** The same answer for every wrong, old or used code, so it never tells which one it was. */
export const BAD_CODE = 'The code is wrong or has expired. Ask for a new code.'

export interface PasswordReset {
  companyId: ObjectId
  codeHash: string
  createdAt: Date
  expiresAt: Date
  tries: number
  usedAt?: Date
}

/** True when a reset code can reach operators somehow; otherwise the BusHub team resets by hand. */
export function resetCodesConfigured(): boolean {
  return emailConfigured() || whatsappCodeConfigured()
}

export function newResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Six digits, whatever spaces or Bangla digits were typed. */
export function cleanResetCode(raw: unknown): string | null {
  const digits = String(raw ?? '')
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/** Why a new password can't be used, or null when it is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.trim().length < PASSWORD_MIN) return `The new password needs at least ${PASSWORD_MIN} characters`
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'That password is too long'
  return null
}

/** Saves a fresh code for the company, replacing any earlier one, and returns it to send. */
export async function createResetCode(db: Db, companyId: ObjectId): Promise<string> {
  const code = newResetCode()
  const now = new Date()
  const resets = db.collection<PasswordReset>('password_resets')
  await resets.deleteMany({ companyId })
  await resets.insertOne({ companyId, codeHash: await bcrypt.hash(code, 8), createdAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS), tries: 0 })
  return code
}

/**
 * Checks a typed code against the company's newest one. A wrong code uses up one try; a right
 * one is marked used in the same step, so it can't reset the password twice.
 */
export async function useResetCode(db: Db, companyId: ObjectId, code: string): Promise<boolean> {
  const resets = db.collection<PasswordReset>('password_resets')
  const reset = await resets.findOne({ companyId, usedAt: { $exists: false }, expiresAt: { $gt: new Date() }, tries: { $lt: CODE_MAX_TRIES } })
  if (!reset) return false
  if (!(await bcrypt.compare(code, reset.codeHash))) {
    await resets.updateOne({ _id: reset._id }, { $inc: { tries: 1 } })
    return false
  }
  const used = await resets.updateOne({ _id: reset._id, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } })
  return used.modifiedCount === 1
}

function resetEmail(code: string, name: string) {
  const text = [
    `Hi ${name},`,
    '',
    `Your BusHub password reset code is ${code}`,
    '',
    'Type it on the "Forgot password" page within 10 minutes. If you did not ask for it, ignore this email: your password stays the same.',
    'Never share this code. The BusHub team will never ask you for it.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111111">
  <p style="font-size:15px">Hi ${escapeHtml(name)},</p>
  <p style="font-size:15px">Your BusHub password reset code is:</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:18px 0;padding:16px;text-align:center;border-radius:14px;background:#fff3e6;color:#111111">${code}</p>
  <p style="font-size:14px;color:#3f3f3f">Type it on the "Forgot password" page within 10 minutes. If you did not ask for it, ignore this email: your password stays the same.</p>
  <p style="font-size:14px;color:#3f3f3f">Never share this code. The BusHub team will never ask you for it.</p>
  <p style="font-size:13px;color:#6b6b6b">BusHub · bushubbd.com</p>
</div>`
  return { text, html }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Sends the code to the account's email and WhatsApp. True when at least one went out. */
export async function sendResetCode(company: { email: string; phone?: string; ownerName?: string; name?: string }, code: string): Promise<boolean> {
  const { text, html } = resetEmail(code, String(company.ownerName || company.name || 'there'))
  const phone = whatsappNumber(String(company.phone || ''))
  const [email, whatsapp] = await Promise.all([
    emailConfigured() ? sendEmail(company.email, `${code} is your BusHub password reset code`, html, text) : Promise.resolve(false),
    phone && whatsappCodeConfigured() ? sendWhatsAppCode(phone, code) : Promise.resolve(false),
  ])
  return email || whatsapp
}
