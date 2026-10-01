/** Words for payout invoices, shared by the pages and the server (no server code here). */

export type PayoutStatus = 'unpaid' | 'paid' | 'confirmed' | 'disputed' | 'cancelled'

export const PAY_METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'cash'] as const
export type PayMethod = (typeof PAY_METHODS)[number]
export const PAY_METHOD_LABELS: Record<PayMethod, string> = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank transfer', cash: 'Cash' }
export const ACCOUNT_LABELS: Record<'bkash' | 'nagad' | 'rocket' | 'bank', string> = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank account' }

export const STATUS_TEXT: Record<PayoutStatus, { label: string; dark: string; light: string }> = {
  unpaid: { label: 'Waiting for BusHub to pay', dark: 'bg-[#f5a524]/[0.15] text-[#fbbf24]', light: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid · waiting for the company to sign', dark: 'bg-[#60a5fa]/[0.15] text-[#93c5fd]', light: 'bg-blue-100 text-blue-800' },
  confirmed: { label: 'Paid and signed', dark: 'bg-[#34d399]/[0.14] text-[#6ee7b7]', light: 'bg-emerald-100 text-emerald-800' },
  disputed: { label: 'Problem reported', dark: 'bg-[#f87171]/[0.14] text-[#fca5a5]', light: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', dark: 'bg-white/[0.07] text-[#9ba7aa]', light: 'bg-gray-100 text-gray-600' },
}

export interface PayoutTotalsView {
  tickets: number
  seats: number
  ticketTotal: number
  commission: number
  payout: number
  /** Refunds taken back from this payment. */
  refunds?: number
}

export interface InvoiceSummaryView {
  _id: string
  number: string
  companyId: string
  companyName: string
  from: string
  to: string
  totals: PayoutTotalsView
  status: PayoutStatus
  createdAt: string
  payment: { method: PayMethod; reference: string; note: string; amount: number; at: string } | null
  confirmation: { signedBy: string; at: string } | null
  dispute: { note: string; by: string; at: string } | null
}
