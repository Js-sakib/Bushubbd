'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatTripDate } from '@/lib/dates'
import { seatsLeft } from '@/lib/seats'
import SeatManager from '../SeatManager'
import { taka } from './charts'
import type { Booking, Bus, CompanyRow } from './types'

/** Add-bus form choice for an operator with no BusHub login; such a bus cannot be scanned. */
const NO_ACCOUNT = 'none'
const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']
const EMPTY_FORM = {
  busName: '', busType: 'AC', companyId: '', companyName: '', from: '', to: '',
  date: '', departureTime: '', arrivalTime: '', price: '', totalSeats: '40', commissionRate: '10', logoUrl: '',
}

export default function BusesSection({
  buses,
  bookings,
  companies,
  onChanged,
}: {
  buses: Bus[]
  bookings: Booking[]
  companies: CompanyRow[]
  onChanged: () => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [open, setOpen] = useState(false)
  const [manageSeatsBusId, setManageSeatsBusId] = useState<string | null>(null)
  const approved = companies.filter((c) => c.status === 'approved')

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/buses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        companyId: form.companyId === NO_ACCOUNT ? '' : form.companyId,
        price: Number(form.price),
        totalSeats: Number(form.totalSeats),
        commissionRate: Number(form.commissionRate),
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Failed to add bus')
      return
    }
    toast.success('Bus added')
    // Keep the company and bus details: the next bus is usually the same operator on another day.
    setForm({ ...form, date: '', departureTime: '', arrivalTime: '' })
    onChanged()
  }

  const handleLinkCompany = async (bus: Bus, companyId: string) => {
    if (!companyId) return
    const res = await fetch(`/api/buses/${bus._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Could not link the bus')
      return
    }
    toast.success('Bus linked. That company can now scan its tickets.')
    onChanged()
  }

  const managed = manageSeatsBusId ? buses.find((b) => b._id === manageSeatsBusId) : null

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="glass flex flex-col">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="display text-[15.5px] font-bold">Add a bus</span>
              <span className="text-[11.5px] text-[#78868a]">Link it to the bus company so they can scan tickets</span>
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 text-[#8e9a9d] transition ${open ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <form onSubmit={handleAddBus} className="grid gap-3 border-t border-white/[0.06] px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Bus name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} className="input-dark" />
            <select required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="input-dark" aria-label="Bus company">
              <option value="" disabled>
                Choose bus company…
              </option>
              {approved.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
              <option value={NO_ACCOUNT}>Other: no BusHub account (can&apos;t scan)</option>
            </select>
            {form.companyId === NO_ACCOUNT && (
              <input placeholder="Operator name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input-dark" />
            )}
            <select value={form.busType} onChange={(e) => setForm({ ...form, busType: e.target.value })} className="input-dark" aria-label="Bus type">
              <option>AC</option>
              <option>Non-AC</option>
              <option>Sleeper</option>
            </select>
            <select required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="input-dark" aria-label="From">
              <option value="">From</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="input-dark" aria-label="To">
              <option value="">To</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-dark" aria-label="Travel date" />
            <input required type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className="input-dark" aria-label="Departure time" />
            <input type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} className="input-dark" aria-label="Arrival time" />
            <input required type="number" placeholder="Price (৳)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-dark" />
            <input required type="number" placeholder="Total seats" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} className="input-dark" aria-label="Total seats" />
            <input required type="number" placeholder="Commission %" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className="input-dark" aria-label="Commission percent" />
            <input placeholder="Bus company logo URL (optional)" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="input-dark sm:col-span-2 lg:col-span-3" />
            <button type="submit" className="glass-btn h-12 sm:col-span-2 lg:col-span-3">
              Add bus
            </button>
          </form>
        )}
      </section>

      <section className="glass flex flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 className="display text-[15.5px] font-bold">All buses</h2>
          <span className="text-[11.5px] text-[#78868a]">{buses.length} listed</span>
        </div>
        {buses.length === 0 && <p className="px-5 pb-8 pt-4 text-center text-sm text-[#8e9a9d]">No buses yet. Add one above.</p>}
        <ul className="flex flex-col">
          {buses.map((b) => {
            const linked = approved.some((c) => c._id === b.companyId)
            const free = seatsLeft(b)
            return (
              <li key={b._id} className={`flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3.5 ${manageSeatsBusId === b._id ? 'bg-white/[0.03]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[14px] font-semibold">{b.busName}</span>
                    <span className="truncate text-[12px] text-[#9ba7aa]">
                      {b.from} → {b.to} · {formatTripDate(b.date)} · {b.departureTime}
                    </span>
                    {linked ? (
                      <span className="truncate text-[11.5px] text-[#6e7b7e]">{b.companyName}</span>
                    ) : (
                      <span className="text-[11.5px] font-bold text-[#f5a524]">{b.companyName} · not linked, can&apos;t scan</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[14px] font-bold tabular-nums">{taka(b.price)}</span>
                    <span className={`text-[11.5px] tabular-nums ${free === 0 ? 'font-bold text-[#fca5a5]' : 'text-[#9ba7aa]'}`}>
                      {free === 0 ? 'Sold out' : `${free}/${b.totalSeats} free`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!linked && (
                    <select
                      value=""
                      onChange={(e) => handleLinkCompany(b, e.target.value)}
                      aria-label={`Link ${b.busName} to a bus company`}
                      className="input-dark h-9 min-w-[170px] grow py-0 text-[12.5px] sm:grow-0"
                    >
                      <option value="">Link to company…</option>
                      {approved.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setManageSeatsBusId(manageSeatsBusId === b._id ? null : b._id)}
                    className="h-9 rounded-full border border-white/10 bg-white/[0.05] px-3.5 text-[12px] font-bold text-[#f5a524] transition hover:bg-white/[0.09]"
                  >
                    {manageSeatsBusId === b._id ? 'Close seats' : 'Manage seats'}
                  </button>
                </div>
                {managed && managed._id === b._id && <SeatManager bus={managed} bookings={bookings} onChange={onChanged} />}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
