'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { COST_LABELS, COST_TYPES, taka, type CostType, type TripCost } from '@/lib/tripMoney'

const UNDO_MS = 60 * 60000

function dhakaTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}

/**
 * A trip's costs: the list with who entered each one, and a short form to add fuel, road, toll or
 * other. The manager can remove any cost; bus staff only their own, within an hour.
 */
export default function CostEditor({
  tripId,
  costs,
  me,
  onChanged,
}: {
  tripId: string
  costs: TripCost[]
  me: { role: string; staffId: string | null }
  onChanged: () => void | Promise<void>
}) {
  const [type, setType] = useState<CostType>('fuel')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const total = costs.reduce((n, c) => n + c.amount, 0)

  const canRemove = (c: TripCost) =>
    me.role === 'manager' || (c.staffId !== null && c.staffId === me.staffId && Date.now() - new Date(c.createdAt).getTime() < UNDO_MS)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value < 1) return toast.error('Type the amount in taka')
    setBusy(true)
    const res = await fetch('/api/company/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, type, amount: value, note }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return toast.error(data?.error || 'No internet connection. Try again.')
    toast.success(`${COST_LABELS[type].en} ${taka(value)} added`)
    setAmount('')
    setNote('')
    await onChanged()
  }

  const remove = async (c: TripCost) => {
    if (!confirm(`Remove ${COST_LABELS[c.type].en} ${taka(c.amount)}?`)) return
    const res = await fetch(`/api/company/costs/${c._id}`, { method: 'DELETE' }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) return toast.error(data?.error || 'Could not remove it')
    await onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="label-xs">Trip costs</span>
          <span className="text-[13px] font-bold text-[#f87171]">{taka(total)}</span>
        </div>
        {costs.length === 0 && <span className="text-[12px] text-[#78868a]">No costs entered yet.</span>}
        {costs.map((c) => (
          <div key={c._id} className="flex items-start gap-3 text-[12.5px]">
            <div className="flex min-w-0 grow flex-col">
              <span className="font-semibold">
                {COST_LABELS[c.type].en} <span className="text-[#78868a]">{COST_LABELS[c.type].bn}</span>
                {c.note && <span className="font-normal text-[#c4cdcf]"> · {c.note}</span>}
              </span>
              <span className="text-[11px] text-[#6e7b7e]">
                {c.addedBy} · {dhakaTime(c.createdAt)}
              </span>
            </div>
            <span className="shrink-0 font-bold text-[#fca5a5]">{taka(c.amount)}</span>
            {canRemove(c) && (
              <button type="button" onClick={() => remove(c)} aria-label="Remove this cost" className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#78868a] hover:bg-white/[0.06] hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={add} className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
        <span className="text-[12.5px] font-bold">Add a cost</span>
        <div className="grid grid-cols-4 gap-1.5">
          {COST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`flex flex-col items-center rounded-xl border px-1 py-2 text-[12px] font-bold transition ${
                type === t ? 'border-[#f5a524] bg-[#f5a524]/[0.12] text-[#f5a524]' : 'border-white/10 text-[#b7c1c3]'
              }`}
            >
              {COST_LABELS[t].en}
              <span className="text-[10.5px] font-semibold opacity-80">{COST_LABELS[t].bn}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="Amount ৳"
            aria-label="Amount in taka"
            className="input-dark w-[42%] min-w-0"
          />
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 100))} placeholder="Note (optional)" aria-label="Note" className="input-dark min-w-0 grow" />
        </div>
        <button type="submit" disabled={busy || !amount} className="glass-btn h-11 text-sm">
          {busy ? 'Adding…' : `Add ${COST_LABELS[type].en.toLowerCase()} cost`}
        </button>
      </form>
    </div>
  )
}
