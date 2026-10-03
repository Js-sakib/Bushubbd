/** Words for payout invoices, shared by the pages and the server (no server code here). */

export type PayoutStatus = 'unpaid' | 'paid' | 'confirmed' | 'disputed' | 'cancelled'

export const PAY_METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'cash'] as const
export type PayMethod = (typeof PAY_METHODS)[number]
export const PAY_METHOD_LABELS: Record<PayMethod, string> = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank transfer', cash: 'Cash' }

export const STATUS_TEXT: Record<PayoutStatus, { label: string; dark: string; light: string }> = {
  unpaid: { label: 'Waiting for BusHub to pay', dark: 'bg-[#feb249]/[0.15] text-[#8a6d00]', light: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid · waiting for the company to sign', dark: 'bg-[#60a5fa]/[0.15] text-[#2563eb]', light: 'bg-blue-100 text-blue-800' },
  confirmed: { label: 'Paid and signed', dark: 'bg-[#3fd0c9]/[0.14] text-[#0a8a84]', light: 'bg-emerald-100 text-emerald-800' },
  disputed: { label: 'Problem reported', dark: 'bg-[#f87171]/[0.14] text-[#c13b3b]', light: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', dark: 'bg-[#0b2545]/[0.05] text-[#44526b]', light: 'bg-gray-100 text-gray-600' },
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
  /** The company checked the tickets and amounts before payment. */
  approval: { by: string; at: string } | null
}

/** The status in words, including the company's approval while BusHub has not paid yet. */
export function statusOf(inv: Pick<InvoiceSummaryView, 'status' | 'approval'>) {
  if (inv.status === 'unpaid' && inv.approval) {
    return { label: 'Approved · waiting for BusHub to pay', dark: 'bg-[#86c6d1]/[0.16] text-[#2d7886]', light: 'bg-violet-100 text-violet-800' }
  }
  if (inv.status === 'unpaid') return { ...STATUS_TEXT.unpaid, label: 'Waiting for the company to approve' }
  return STATUS_TEXT[inv.status]
}
