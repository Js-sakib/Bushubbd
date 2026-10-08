'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { latinDigits, mobileCore } from '@/lib/ticketLookup'
import { METHOD_LABEL, type CounterTicketView } from './Receipt'
import type { CompanyTrip } from './types'

const tk = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`
const METHODS = ['cash', 'bkash', 'nagad'] as const

/**
 * The sale being made at the counter: the chosen seats, the passenger, the fare and how they paid.
 * Enter sells: the seats come off sale everywhere at once and the sale is recorded. No ticket is
 * printed here: the bus company gives the passenger its own ticket.
 */
export default function CounterSale({
  trip,
  seats,
  onRemoveSeat,
  onClear,
  onSold,
}: {
  trip: CompanyTrip
  seats: string[]
  onRemoveSeat: (seat: string) => void
  onClear: () => void
  onSold: (ticket: CounterTicketView) => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [regular, setRegular] = useState<number | null>(null)
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash')
  const [trx, setTrx] = useState('')
  const [fare, setFare] = useState(String(trip.price))
  const [why, setWhy] = useState('')
  const [received, setReceived] = useState('')
  const [busy, setBusy] = useState(false)
  const lastLookup = useRef('')

  // A new trip starts a fresh sale at that trip's price.
  useEffect(() => {
    setFare(String(trip.price))
    setWhy('')
  }, [trip._id, trip.price])

  // A number typed in full fills in the name this passenger gave last time.
  useEffect(() => {
    const core = mobileCore(phone)
    if (!core || lastLookup.current === core) return
    lastLookup.current = core
    fetch(`/api/company/counter-tickets?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => {
        const past = (d.tickets || []) as { passengerName: string }[]
        setRegular(past.length || null)
        const known = past.find((t) => t.passengerName)?.passengerName
        if (known) setName((n) => n || known)
      })
      .catch(() => {})
  }, [phone])

  const fareNum = Number(latinDigits(fare)) || 0
  const total = fareNum * seats.length
  const discounted = fareNum < trip.price
  const receivedNum = received ? Number(latinDigits(received)) || 0 : null
  const change = method === 'cash' && receivedNum !== null ? receivedNum - total : null
  // Quick cash buttons: the exact amount and the next round notes up.
  const roundUps = Array.from(new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])).filter((n) => n > 0).slice(0, 4)

  const reset = () => {
    setPhone('')
    setName('')
    setRegular(null)
    setTrx('')
    setReceived('')
    setWhy('')
    setFare(String(trip.price))
    setMethod('cash')
    lastLookup.current = ''
  }

  const sell = async () => {
    if (seats.length === 0) return toast.error('Tap the seats to sell first')
    if (phone && !mobileCore(phone)) return toast.error('Write the phone number like 01712345678')
    if (discounted && why.trim().length < 3) return toast.error(`Say why the fare is less than ৳${trip.price}`)
    if (change !== null && change < 0) return toast.error(`Cash received is less than ${tk(total)}`)
    setBusy(true)
    const res = await fetch('/api/company/counter-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        busId: trip._id,
        seats,
        passengerName: name,
        passengerPhone: phone,
        paymentMethod: method,
        paymentRef: trx,
        fare: fareNum,
        discountNote: why,
        received: method === 'cash' ? received : '',
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(false)
    if (!res?.ok || !data?.ticket) return toast.error(data?.error || 'Could not sell, check the connection and try again')
    toast.success(`Sold ${seats.length} seat${seats.length === 1 ? '' : 's'} · ${data.ticket.ticketCode}`)
    reset()
    onSold(data.ticket)
  }

  const field = 'input-dark !h-11 text-[14px]'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        sell()
      }}
      id="counter-sale"
      className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border-2 border-[#f2661d]/40 bg-white/85 p-4"
      aria-label="Sale"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="display text-[16px] font-bold">New sale</span>
        {seats.length > 0 && (
          <button type="button" onClick={onClear} className="text-[12px] font-bold text-[#0b7f8c]">
            Clear (Esc)
          </button>
        )}
      </div>

      {seats.length === 0 ? (
        <p className="rounded-xl bg-[#feb249]/15 px-3 py-2.5 text-[13px] text-[#3f3f3f]">Tap the free seats on the map to add them to this sale.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {seats.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onRemoveSeat(s)}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#feb249] to-[#f2661d] px-3 py-1 text-[13px] font-bold text-[#1a0d03]"
              aria-label={`Remove seat ${s}`}
            >
              {s} <span aria-hidden>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className={field} />
          {regular && <span className="text-[11px] font-semibold text-[#0a8a84]">Regular passenger · {regular} trip{regular === 1 ? '' : 's'} before</span>}
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Passenger name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} maxLength={60} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold">Payment</span>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Payment method">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`h-11 rounded-xl text-[14px] font-bold transition ${
                method === m
                  ? m === 'bkash'
                    ? 'bg-[#E2136E] text-white'
                    : m === 'nagad'
                      ? 'bg-[#F6921E] text-[#1a0d03]'
                      : 'bg-[#0a8a84] text-white'
                  : 'border border-[#111111]/15 bg-white text-[#222222]'
              }`}
            >
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
        {method !== 'cash' && (
          <input value={trx} onChange={(e) => setTrx(e.target.value)} placeholder={`${METHOD_LABEL[method]} TrxID (optional)`} className={field} maxLength={24} />
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Fare per seat (৳)
          <input value={fare} onChange={(e) => setFare(e.target.value)} inputMode="numeric" className={field} />
        </label>
        {discounted && (
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            Why less than ৳{trip.price}?
            <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Student, staff, regular…" className={field} maxLength={120} />
          </label>
        )}
      </div>

      {method === 'cash' && seats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            Cash received (৳)
            <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="numeric" placeholder={String(total)} className={field} />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {roundUps.map((n) => (
              <button key={n} type="button" onClick={() => setReceived(String(n))} className="chip !h-8 !px-3 text-[12px]">
                {n === total ? 'Exact' : tk(n)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-xl bg-[#111111]/[0.04] px-3.5 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-[#3f3f3f]">
            {seats.length} seat{seats.length === 1 ? '' : 's'} × {tk(fareNum)}
          </span>
          <span className="display text-[22px] font-extrabold">{tk(total)}</span>
        </div>
        {change !== null && (
          <div className={`flex justify-between text-[14px] font-bold ${change < 0 ? 'text-[#c02626]' : 'text-[#0a8a84]'}`}>
            <span>{change < 0 ? 'Still to pay' : 'Change to give'}</span>
            <span>{tk(Math.abs(change))}</span>
          </div>
        )}
      </div>

      <button type="submit" disabled={busy || seats.length === 0} className="glass-btn h-12 text-[15px] disabled:opacity-50">
        {busy ? 'Selling…' : `Sell ${seats.length || ''} seat${seats.length === 1 ? '' : 's'} (Enter)`}
      </button>
    </form>
  )
}
