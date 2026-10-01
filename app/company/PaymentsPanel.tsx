'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import PasswordInput from '../PasswordInput'
import { formatTripDate } from '@/lib/dates'
import { ACCOUNT_METHODS, type AccountMethod, type PayoutAccount } from '@/lib/payoutAccount'
import { ACCOUNT_LABELS, STATUS_TEXT, type InvoiceSummaryView, type PayoutTotalsView } from '@/lib/payoutText'
import { taka } from '@/lib/tripMoney'

export interface PaymentsData {
  owed: PayoutTotalsView
  later: PayoutTotalsView
  invoiced: number
  invoices: InvoiceSummaryView[]
  refunds: { _id: string; code: string; date: string; from: string; to: string; seats: string[]; amount: number; paidIn: string }[]
  account: PayoutAccount | null
}

/** Where BusHub sends the money. Saving needs the company password. */
function AccountCard({ account, onSaved }: { account: PayoutAccount | null; onSaved: () => void }) {
  const [open, setOpen] = useState(!account)
  const [method, setMethod] = useState<AccountMethod>(account?.method || 'bkash')
  const [number, setNumber] = useState(account?.number || '')
  const [name, setName] = useState(account?.name || '')
  const [bank, setBank] = useState(account?.bank || '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await fetch('/api/company/payout-account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, number, name, bank, password }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return toast.error(data?.error || 'No internet connection. Try again.')
    toast.success('Saved. BusHub will pay you here.')
    setPassword('')
    setOpen(false)
    onSaved()
  }

  return (
    <div className="card-2 flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="label-xs">Where BusHub pays you</span>
          {account ? (
            <>
              <span className="text-[14px] font-bold">
                {ACCOUNT_LABELS[account.method]} · <span className="font-mono">{account.number}</span>
              </span>
              <span className="text-[12px] text-[#9ba7aa]">
                {account.name}
                {account.bank ? ` · ${account.bank}` : ''}
              </span>
            </>
          ) : (
            <span className="text-[12.5px] text-[#fbbf24]">Not set yet. Add it so BusHub knows where to send your money.</span>
          )}
        </div>
        {account && !open && (
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-[12.5px] font-semibold text-[#f5a524]">
            Change
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="flex flex-col gap-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            {ACCOUNT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl border px-1 py-2 text-[12px] font-bold ${method === m ? 'border-[#f5a524] bg-[#f5a524]/[0.12] text-[#f5a524]' : 'border-white/10 text-[#b7c1c3]'}`}
              >
                {m === 'bank' ? 'Bank' : ACCOUNT_LABELS[m]}
              </button>
            ))}
          </div>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.slice(0, 30))}
            inputMode={method === 'bank' ? 'text' : 'numeric'}
            placeholder={method === 'bank' ? 'Account number' : `${ACCOUNT_LABELS[method]} number, e.g. 01712345678`}
            className="input-dark font-mono"
            aria-label="Account number"
          />
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Name on the account" className="input-dark" aria-label="Name on the account" />
          {method === 'bank' && (
            <input value={bank} onChange={(e) => setBank(e.target.value.slice(0, 80))} placeholder="Bank and branch, e.g. DBBL, Agrabad" className="input-dark" aria-label="Bank and branch" />
          )}
          <PasswordInput value={password} onChange={setPassword} placeholder="Company login password, to confirm" autoComplete="current-password" />
          <button type="submit" disabled={busy || !number || !name || !password} className="glass-btn h-11 text-sm">
            {busy ? 'Saving…' : 'Save'}
          </button>
          {account && (
            <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] font-semibold text-[#9ba7aa]">
              Cancel
            </button>
          )}
          <p className="text-[11px] text-[#6e7b7e]">For your safety this needs your password, and BusHub sees when it was last changed.</p>
        </form>
      )}
    </div>
  )
}

const range = (from: string, to: string) => (from === to ? formatTripDate(from) : `${formatTripDate(from)} – ${formatTripDate(to)}`)

/**
 * The manager's payments from BusHub: what is owed after commission, and every invoice with its
 * tickets. A paid invoice waits for the manager to check the money arrived and sign it.
 */
export default function PaymentsPanel({ data, onChanged }: { data: PaymentsData | null; onChanged: () => void }) {
  if (!data) return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>
  const toSign = data.invoices.filter((i) => i.status === 'paid')
  const received = data.invoices.filter((i) => i.status === 'confirmed').reduce((n, i) => n + i.totals.payout, 0)
  const refunds = data.refunds.reduce((n, r) => n + r.amount, 0)

  return (
    <div className="flex flex-col gap-3">
      {toSign.length > 0 && (
        <a href={`/invoice/${toSign[0]._id}`} className="flex items-center gap-3 rounded-2xl border border-[#60a5fa]/40 bg-[#60a5fa]/[0.1] px-4 py-3">
          <span className="grow text-[13px] font-semibold text-[#bfdbfe]">
            BusHub paid {taka(toSign[0].totals.payout)}. Check the money arrived and sign.
          </span>
          <span className="text-[12.5px] font-bold text-[#93c5fd]">Open ›</span>
        </a>
      )}

      <div className="card-2 flex flex-col gap-2.5 px-4 py-4">
        <span className="label-xs">BusHub owes you · after commission</span>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13.5px] font-bold">For trips that have left</span>
            <span className="text-[11.5px] text-[#78868a]">
              {data.owed.tickets} tickets · {data.owed.seats} seats · price {taka(data.owed.ticketTotal)} · commission {taka(data.owed.commission)}
            </span>
          </div>
          <span className="shrink-0 text-[17px] font-bold text-[#f5a524]">{taka(data.owed.payout + data.invoiced)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13px] text-[#c4cdcf]">For trips still to leave</span>
            <span className="text-[11.5px] text-[#78868a]">Paid out after the bus leaves</span>
          </div>
          <span className="shrink-0 text-[14px] font-bold text-[#c4cdcf]">{taka(data.later.payout)}</span>
        </div>
        {refunds > 0 && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-[#c4cdcf]">Refunds taken back</span>
              <span className="text-[11.5px] text-[#78868a]">Comes off your next payment</span>
            </div>
            <span className="shrink-0 text-[14px] font-bold text-[#fca5a5]">−{taka(refunds)}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 border-t border-white/[0.06] pt-2.5">
          <span className="text-[13px] text-[#c4cdcf]">Received and signed so far</span>
          <span className="shrink-0 text-[14px] font-bold text-[#34d399]">{taka(received)}</span>
        </div>
      </div>

      <AccountCard account={data.account} onSaved={onChanged} />

      {data.refunds.length > 0 && (
        <div className="card-2 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#1a2123] px-4 py-3">
            <span className="label-xs">Refunded after payment</span>
            <span className="text-[13px] font-bold text-[#fca5a5]">−{taka(refunds)}</span>
          </div>
          <p className="px-4 pt-3 text-[11.5px] text-[#78868a]">
            These tickets were refunded to the passenger after BusHub had already paid you for them. The amount comes off your next payment.
          </p>
          {data.refunds.map((r) => (
            <div key={r._id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-[12.5px]">
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-[11.5px]">{r.code}</span>
                <span className="text-[11.5px] text-[#78868a]">
                  {r.from} → {r.to} · {formatTripDate(r.date)} · seats {r.seats.join(', ')} · paid in {r.paidIn}
                </span>
              </span>
              <span className="shrink-0 font-bold text-[#fca5a5]">−{taka(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#1a2123] px-4 py-3">
          <span className="label-xs">Invoices from BusHub</span>
        </div>
        {data.invoices.map((i) => (
          <a key={i._id} href={`/invoice/${i._id}`} className="flex items-start gap-3 border-b border-[#1a2123] px-4 py-3 last:border-b-0 hover:bg-white/[0.03]">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="font-mono text-[13px] font-bold">{i.number}</span>
              <span className="text-[11.5px] text-[#9ba7aa]">
                {range(i.from, i.to)} · {i.totals.tickets} tickets · {i.totals.seats} seats
              </span>
              <span className={`self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TEXT[i.status].dark}`}>{STATUS_TEXT[i.status].label}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-[14px] font-bold">{taka(i.totals.payout)}</span>
              <span className="text-[10.5px] text-[#f5a524]">Open ›</span>
            </div>
          </a>
        ))}
        {data.invoices.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No invoices yet. BusHub makes one when it pays you.</div>}
      </div>
    </div>
  )
}
