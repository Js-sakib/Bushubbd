import type { Sheet } from './sheet'
import { PAY_METHOD_LABELS, statusOf, type InvoiceSummaryView } from './payoutText'

/** Shown in red on the invoices sheet: invoices that need someone to act. */
export const PROBLEM_STATUSES = ['Problem reported']

/**
 * Payout invoices as an Excel sheet, for the admin's Payouts and the manager's Payments: each
 * invoice with its trip dates, tickets, money after commission, refunds taken back and how it
 * was paid and signed.
 */
export function invoicesSheet(invoices: InvoiceSummaryView[], notes: string[], withCompany: boolean): Sheet {
  return {
    name: 'Invoices',
    title: 'Payout invoices',
    notes: [...notes, 'Red = a problem was reported on the invoice.'],
    columns: [
      { header: 'Invoice' },
      ...(withCompany ? [{ header: 'Company' }] : []),
      { header: 'Made on', kind: 'datetime' },
      { header: 'Trips from', kind: 'date' },
      { header: 'Trips to', kind: 'date' },
      { header: 'Tickets', kind: 'int', total: true },
      { header: 'Seats', kind: 'int', total: true },
      { header: 'Ticket money', kind: 'taka', total: true },
      { header: 'BusHub commission', kind: 'taka', total: true },
      { header: 'Refunds taken back', kind: 'taka', total: true },
      { header: 'Payout', kind: 'taka', total: true },
      { header: 'Status', highlight: { equals: PROBLEM_STATUSES } },
      { header: 'Paid by' },
      { header: 'Payment reference' },
      { header: 'Paid on', kind: 'datetime' },
      { header: 'Signed by' },
      { header: 'Signed on', kind: 'datetime' },
      { header: 'Problem reported', kind: 'wrap' },
    ],
    rows: [...invoices]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => [
        i.number,
        ...(withCompany ? [i.companyName] : []),
        i.createdAt,
        i.from,
        i.to,
        i.totals.tickets,
        i.totals.seats,
        i.totals.ticketTotal,
        i.totals.commission,
        i.totals.refunds || 0,
        i.totals.payout,
        statusOf(i).label,
        i.payment ? PAY_METHOD_LABELS[i.payment.method] || i.payment.method : '',
        i.payment?.reference || '',
        i.payment?.at || '',
        i.confirmation?.signedBy || '',
        i.confirmation?.at || '',
        i.dispute?.note || '',
      ]),
  }
}

/** Money paid out and signed for, across the invoices. */
export function paidTotal(invoices: InvoiceSummaryView[]): number {
  return invoices.filter((i) => i.status === 'paid' || i.status === 'confirmed').reduce((n, i) => n + i.totals.payout, 0)
}
