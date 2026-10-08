'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { METHOD_LABEL, maskPhone, type CounterTicketView } from './Receipt'

const tk = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`
const dhakaTime = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)) : ''

/** One counter ticket in a sheet: what was sold, to whom, how it was paid; reprint or cancel it. */
export default function CounterTicketSheet({
  ticket,
  canCancel,
  onClose,
  onPrint,
  onCancelled,
}: {
  ticket: CounterTicketView
  canCancel: boolean
  onClose: () => void
  onPrint: () => void
  onCancelled: () => void
}) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    if (reason.trim().length < 3) return toast.error('Say why the ticket is cancelled')
    setBusy(true)
    const res = await fetch(`/api/company/counter-tickets/${ticket.ticketCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', reason }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(false)
    if (!res?.ok) return toast.error(data?.error || 'Could not cancel the ticket')
    toast.success(`Ticket cancelled · seats ${ticket.seats.join(', ')} are free again`)
    onCancelled()
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="text-[#4a4a4a]">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#111111]/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.ticketCode}`} onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="display text-[17px] font-bold">
              {ticket.from} → {ticket.to}
            </span>
            <span className="text-[12px] text-[#3f3f3f]">
              {formatTripDate(ticket.date)} · {ticket.departureTime} · {ticket.busName}
            </span>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 shrink-0 rounded-full bg-[#111111]/[0.06] text-[16px] font-bold" aria-label="Close">
            ✕
          </button>
        </div>

        {ticket.status === 'cancelled' && (
          <p className="rounded-xl bg-[#f87171]/[0.12] px-3 py-2 text-[12.5px] font-semibold text-[#b42318]">
            Cancelled {dhakaTime(ticket.cancelledAt)} by {ticket.cancelledBy}: {ticket.cancelReason}
          </p>
        )}
        {ticket.checkedIn && <p className="rounded-xl bg-[#3fd0c9]/15 px-3 py-2 text-[12.5px] font-semibold text-[#0a6e69]">Boarded {dhakaTime(ticket.checkedInAt)}</p>}

        <div className="flex flex-col gap-2 rounded-2xl border border-[#111111]/10 bg-[#111111]/[0.02] p-3.5">
          {row('Ticket', <span className="font-mono">{ticket.ticketCode}</span>)}
          {row('Seats', <span className="text-[15px] font-extrabold">{ticket.seats.join(', ')}</span>)}
          {(ticket.passengerName || ticket.passengerPhone) && row('Passenger', `${ticket.passengerName || ''} ${maskPhone(ticket.passengerPhone)}`.trim())}
          {row('Paid', `${tk(ticket.total)} · ${METHOD_LABEL[ticket.paymentMethod]}${ticket.paymentRef ? ` ${ticket.paymentRef}` : ''}`)}
          {ticket.fare < ticket.tripPrice && row('Discount', `${tk(ticket.tripPrice - ticket.fare)}/seat · ${ticket.discountNote || ''}`)}
          {row('Sold', `${ticket.soldBy} · ${dhakaTime(ticket.soldAt)}`)}
        </div>

        {cancelling ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[12px] font-bold">
              Why cancel?
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Passenger changed plan, wrong seat…" className="input-dark !h-11 text-[14px]" maxLength={160} autoFocus />
            </label>
            <p className="text-[12px] text-[#3f3f3f]">Give back {tk(ticket.total)} to the passenger. The seats go back on sale.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCancelling(false)} className="glass-btn glass-btn-plain h-11 text-[13px]">
                Keep ticket
              </button>
              <button type="button" disabled={busy} onClick={cancel} className="h-11 rounded-full bg-[#c02626] text-[13px] font-bold text-white disabled:opacity-50">
                {busy ? 'Cancelling…' : 'Cancel ticket'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onPrint} className="glass-btn h-11 text-[13px]">
              Print again
            </button>
            {canCancel && ticket.status === 'sold' && !ticket.checkedIn ? (
              <button type="button" onClick={() => setCancelling(true)} className="glass-btn glass-btn-plain h-11 text-[13px] !text-[#c02626]">
                Cancel ticket
              </button>
            ) : (
              <button type="button" onClick={onClose} className="glass-btn glass-btn-plain h-11 text-[13px]">
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
