/** Where BusHub sends a company's money. Words and checks shared by the pages and the server. */

export const ACCOUNT_METHODS = ['bkash', 'nagad', 'rocket', 'bank'] as const
export type AccountMethod = (typeof ACCOUNT_METHODS)[number]

export interface PayoutAccount {
  method: AccountMethod
  /** The mobile wallet number, or the bank account number. */
  number: string
  /** The name on the wallet or account. */
  name: string
  /** Bank only: bank and branch. */
  bank?: string
  updatedAt: string
  updatedBy: string
}

/** A payout account in a request, checked; or why it is wrong. */
export function readAccount(body: any): Omit<PayoutAccount, 'updatedAt' | 'updatedBy'> | { error: string } {
  const method = String(body.method || '') as AccountMethod
  if (!ACCOUNT_METHODS.includes(method)) return { error: 'Choose bKash, Nagad, Rocket or bank' }
  const name = String(body.name || '').replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 60) return { error: 'Type the name on the account' }
  if (method === 'bank') {
    const number = String(body.number || '').replace(/\s+/g, '')
    const bank = String(body.bank || '').replace(/\s+/g, ' ').trim()
    if (!/^[0-9A-Za-z-]{6,30}$/.test(number)) return { error: 'Type the bank account number' }
    if (bank.length < 3 || bank.length > 80) return { error: 'Type the bank and branch' }
    return { method, number, name, bank }
  }
  const digits = String(body.number || '').replace(/[^\d]/g, '').replace(/^880/, '0')
  if (!/^01[3-9]\d{8}$/.test(digits)) return { error: 'Type the 11-digit mobile number, e.g. 01712345678' }
  return { method, number: digits, name }
}

/** Changed in the last 3 days: the admin double-checks by phone before sending money there. */
export function recentlyChanged(account: { updatedAt: string } | null | undefined, now = Date.now()): boolean {
  return Boolean(account && now - new Date(account.updatedAt).getTime() < 3 * 86400000)
}
