'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { adminPath } from '@/lib/panelNav'
import { generateSeatLabels } from '@/lib/seats'
import { formatShortDay, formatTripDate } from '@/lib/dates'

interface Bus {
  _id: string
  companyName: string
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  price: number
  totalSeats: number
  bookedSeats: string[]
  status: string
}

interface Booking {
  _id: string
  bookingCode: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  commissionAmount: number
  companyPayout: number
  passengerName: string
  passengerPhone: string
  paymentStatus: string
  status: string
  createdAt: string
}

interface CompanyRow {
  _id: string
  name: string
  ownerName: string
  email: string
  phone: string
  status: string
  createdAt: string
}

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']
const TABS = ['overview', 'buses', 'companies'] as const

export default function AdminDashboard() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview')

  const [buses, setBuses] = useState<Bus[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [manageSeatsBusId, setManageSeatsBusId] = useState<string | null>(null)

  const [form, setForm] = useState({
    busName: '', busType: 'AC', companyName: 'BusHub', from: '', to: '',
    date: '', departureTime: '', arrivalTime: '', price: '', totalSeats: '40', commissionRate: '10',
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== 'admin') {
          router.push(adminPath('/admin/login'))
        } else {
          setChecking(false)
          loadAll()
        }
      })
  }, [])

  const loadAll = () => {
    fetch('/api/buses').then((r) => r.json()).then((d) => setBuses(d.buses || []))
    fetch('/api/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || []))
    fetch('/api/companies').then((r) => r.json()).then((d) => setCompanies(d.companies || []))
  }

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push(adminPath('/admin/login'))
  }

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/buses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        totalSeats: Number(form.totalSeats),
        commissionRate: Number(form.commissionRate),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add bus')
      return
    }
    toast.success('Bus added')
    setForm({ ...form, from: '', to: '', date: '', departureTime: '', arrivalTime: '', price: '' })
    loadAll()
  }

  const handleToggleSeat = async (bus: Bus, seatLabel: string) => {
    const isBooked = bus.bookedSeats?.includes(seatLabel)
    const res = await fetch(`/api/buses/${bus._id}/seats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: [seatLabel], action: isBooked ? 'release' : 'book' }),
    })
    if (res.ok) loadAll()
    else toast.error('Failed to update seat')
  }

  const handleRefund = async (bookingId: string) => {
    if (!confirm('Mark this ticket as refunded? The seat will be released back to available.')) return
    const res = await fetch(`/api/bookings/${bookingId}/refund`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to refund')
      return
    }
    toast.success('Ticket refunded')
    loadAll()
  }

  const handleCompanyStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success('Company updated')
      loadAll()
    } else {
      toast.error('Failed to update company')
    }
  }

  if (checking) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking access...</div>
  }

  const sold = bookings.filter((b) => b.paymentStatus === 'paid' && b.status === 'confirmed')
  const refunded = bookings.filter((b) => b.status === 'refunded')
  const totalRevenue = sold.reduce((sum, b) => sum + b.totalPrice, 0)
  const totalCommission = sold.reduce((sum, b) => sum + (b.commissionAmount || 0), 0)
  const refundedAmount = refunded.reduce((sum, b) => sum + b.totalPrice, 0)
  const totalOwed = sold.reduce((sum, b) => sum + (b.companyPayout || 0), 0)

  const payoutByCompany: Record<string, { tickets: number; owed: number }> = {}
  for (const b of sold) {
    if (!payoutByCompany[b.companyName]) payoutByCompany[b.companyName] = { tickets: 0, owed: 0 }
    payoutByCompany[b.companyName].tickets += 1
    payoutByCompany[b.companyName].owed += b.companyPayout || 0
  }

  const soldByDay: Record<string, number> = {}
  for (const b of sold) {
    const day = (b.createdAt || '').slice(0, 10)
    if (day) soldByDay[day] = (soldByDay[day] || 0) + 1
  }
  const last7: { day: string; label: string; value: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    last7.push({ day: key, label: formatShortDay(d), value: soldByDay[key] || 0 })
  }
  const peak = Math.max(1, ...last7.map((d) => d.value))

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 border-b border-[#1b2325] pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
        <div className="flex grow flex-col gap-0.5">
          <h1 className="display text-[19px] font-bold leading-tight">Overview</h1>
          <span className="text-[11.5px] text-[#78868a]">{formatTripDate(new Date().toISOString().slice(0, 10))}</span>
        </div>
        <button type="button" onClick={handleLogout} className="chip">
          Logout
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? 'chip-active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#12756c] to-[#0e5a54] p-4">
              <span className="text-[11.5px] font-bold text-[#b8ede6]">Tickets sold</span>
              <span className="display text-3xl font-bold leading-none text-white">{sold.length}</span>
              <span className="text-[11.5px] text-[#b8ede6]">Paid and confirmed</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#2f5bc4] to-[#24479b] p-4">
              <span className="text-[11.5px] font-bold text-[#c9d8fa]">Total revenue</span>
              <span className="display text-[26px] font-bold leading-tight text-white">৳{totalRevenue.toLocaleString()}</span>
              <span className="text-[11.5px] text-[#c9d8fa]">Collected from passengers</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#c77a0e] to-[#a25f06] p-4">
              <span className="text-[11.5px] font-bold text-[#fae3bc]">Your commission</span>
              <span className="display text-[26px] font-bold leading-tight text-white">৳{totalCommission.toLocaleString()}</span>
              <span className="text-[11.5px] text-[#fae3bc]">What BusHub keeps</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#b23b34] to-[#8e2b26] p-4">
              <span className="text-[11.5px] font-bold text-[#f8d3d0]">Refunded</span>
              <span className="display text-3xl font-bold leading-none text-white">{refunded.length}</span>
              <span className="text-[11.5px] text-[#f8d3d0]">৳{refundedAmount.toLocaleString()} returned</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="card-2 flex flex-col gap-4 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="display text-[15px] font-bold">Tickets sold per day</h2>
                <span className="text-[11.5px] text-[#78868a]">Last 7 days</span>
              </div>
              <div className="flex h-[150px] items-end gap-0.5">
                {last7.map((d) => {
                  const isPeak = d.value === peak && d.value > 0
                  return (
                    <div key={d.day} className="flex h-full min-w-0 grow basis-0 flex-col items-center justify-end gap-2">
                      <span className={`text-[11px] font-bold ${isPeak ? 'text-[#f6f4ef]' : 'text-transparent'}`}>{d.value}</span>
                      <div
                        className="w-[58%] rounded-t"
                        style={{
                          height: `${Math.round((d.value / peak) * 100)}px`,
                          minHeight: d.value > 0 ? '4px' : '2px',
                          background: isPeak ? '#f5a524' : d.value > 0 ? '#8a6a28' : '#1f2729',
                        }}
                      />
                      <span className="text-[11px] font-semibold text-[#78868a]">{d.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card-2 flex flex-col gap-3.5 p-5">
              <h2 className="display text-[15px] font-bold">You owe each company</h2>
              {Object.keys(payoutByCompany).length === 0 ? (
                <p className="text-[13px] text-[#8e9a9d]">No paid tickets yet.</p>
              ) : (
                Object.entries(payoutByCompany).map(([company, data]) => (
                  <div key={company} className="flex items-center gap-3 border-b border-[#1f2729] pb-3 last:border-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5a524]/[0.13] text-xs font-bold text-[#f5a524]">
                      {company.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex grow flex-col">
                      <span className="text-[13px] font-bold">{company}</span>
                      <span className="text-[11px] text-[#78868a]">{data.tickets} ticket(s)</span>
                    </div>
                    <span className="display text-[15px] font-bold">৳{data.owed.toLocaleString()}</span>
                  </div>
                ))
              )}
              <div className="mt-auto flex items-center justify-between border-t border-dashed border-[#263033] pt-3">
                <span className="text-xs font-semibold text-[#a8b3b6]">Total to pay out</span>
                <span className="display text-[17px] font-bold text-[#f5a524]">৳{totalOwed.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card-2 overflow-hidden">
            <div className="border-b border-[#1f2729] px-5 py-4">
              <h2 className="display text-[15px] font-bold">Tickets</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="label-xs px-5 py-3">Route</th>
                    <th className="label-xs px-3 py-3">Date &amp; time</th>
                    <th className="label-xs px-3 py-3">Company</th>
                    <th className="label-xs px-3 py-3 text-right">Price</th>
                    <th className="label-xs px-3 py-3 text-right">You owe</th>
                    <th className="label-xs px-3 py-3">Status</th>
                    <th className="label-xs px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id} className="border-t border-[#1a2123]">
                      <td className="px-5 py-3 text-[13px] font-semibold">
                        {b.from} → {b.to}
                        <span className="block text-[11px] font-normal text-[#78868a]">{b.seats.join(', ')}</span>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">
                        {b.date} · {b.departureTime}
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.companyName}</td>
                      <td className="px-3 py-3 text-right text-[13px] font-bold">৳{b.totalPrice}</td>
                      <td className="px-3 py-3 text-right text-[13px] text-[#a8b3b6]">৳{b.companyPayout ?? 0}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold ${
                            b.status === 'refunded'
                              ? 'bg-[#f87171]/[0.12] text-[#f87171]'
                              : b.status === 'confirmed'
                              ? 'bg-[#34d399]/[0.13] text-[#34d399]'
                              : b.status === 'expired'
                              ? 'bg-white/[0.06] text-[#8e9a9d]'
                              : 'bg-[#f5a524]/[0.13] text-[#f5a524]'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {b.paymentStatus === 'paid' && b.status === 'confirmed' ? (
                          <button
                            type="button"
                            onClick={() => handleRefund(b._id)}
                            className="h-8 rounded-full border border-[#3a2a2a] bg-[#f87171]/10 px-3 text-xs font-bold text-[#f87171]"
                          >
                            Refund
                          </button>
                        ) : (
                          <span className="text-xs text-[#6e7b7e]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#8e9a9d]">
                        No tickets sold yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'buses' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="card-2 p-5">
            <h2 className="display mb-4 text-[15px] font-bold">Add a bus</h2>
            <form onSubmit={handleAddBus} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input required placeholder="Bus name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} className="input-dark" />
              <input placeholder="Operator name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input-dark" />
              <select value={form.busType} onChange={(e) => setForm({ ...form, busType: e.target.value })} className="input-dark">
                <option>AC</option>
                <option>Non-AC</option>
                <option>Sleeper</option>
              </select>
              <select required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="input-dark">
                <option value="">From</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="input-dark">
                <option value="">To</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-dark" />
              <input required type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className="input-dark" />
              <input type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} className="input-dark" />
              <input required type="number" placeholder="Price (৳)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-dark" />
              <input required type="number" placeholder="Total seats" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} className="input-dark" />
              <input required type="number" placeholder="Commission %" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className="input-dark" />
              <button type="submit" className="glass-btn h-12 sm:col-span-2 lg:col-span-3">
                Add bus
              </button>
            </form>
          </div>

          <div className="card-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="label-xs px-5 py-3">Bus</th>
                  <th className="label-xs px-3 py-3">Route</th>
                  <th className="label-xs px-3 py-3">Date / time</th>
                  <th className="label-xs px-3 py-3 text-right">Price</th>
                  <th className="label-xs px-3 py-3 text-right">Seats free</th>
                  <th className="label-xs px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b._id} className="border-t border-[#1a2123]">
                    <td className="px-5 py-3 text-[13px] font-semibold">
                      {b.busName}
                      <span className="block text-[11px] font-normal text-[#78868a]">{b.companyName}</span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.from} → {b.to}</td>
                    <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.date} {b.departureTime}</td>
                    <td className="px-3 py-3 text-right text-[13px] font-bold">৳{b.price}</td>
                    <td className="px-3 py-3 text-right text-[13px]">
                      {b.totalSeats - (b.bookedSeats?.length || 0)}/{b.totalSeats}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setManageSeatsBusId(manageSeatsBusId === b._id ? null : b._id)}
                        className="text-[13px] font-semibold text-[#f5a524] hover:underline"
                      >
                        {manageSeatsBusId === b._id ? 'Close' : 'Manage seats'}
                      </button>
                    </td>
                  </tr>
                ))}
                {buses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#8e9a9d]">
                      No buses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {manageSeatsBusId && (() => {
            const bus = buses.find((b) => b._id === manageSeatsBusId)
            if (!bus) return null
            return (
              <div className="card-2 flex flex-col gap-4 p-5">
                <div>
                  <h3 className="display text-[15px] font-bold">
                    {bus.busName} · {bus.from} → {bus.to} ({bus.date})
                  </h3>
                  <p className="mt-1 text-[12.5px] text-[#9ba7aa]">
                    Tap a seat to mark it sold (counter or phone sale) or release it back. The customer site updates instantly.
                  </p>
                </div>
                <div className="grid max-w-2xl grid-cols-8 gap-2 sm:grid-cols-12">
                  {generateSeatLabels(bus.totalSeats).map((seatLabel) => {
                    const isBooked = bus.bookedSeats?.includes(seatLabel)
                    return (
                      <button
                        key={seatLabel}
                        type="button"
                        onClick={() => handleToggleSeat(bus, seatLabel)}
                        className={`h-9 rounded-lg text-[11.5px] font-bold transition ${
                          isBooked
                            ? 'bg-[#f87171] text-[#1a0808] hover:bg-[#ef5b5b]'
                            : 'border border-[#38444a] bg-[#1c2426] text-[#d6dee0] hover:border-[#34d399]'
                        }`}
                      >
                        {seatLabel}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-4 text-[12.5px] text-[#c4cdcf]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-[#38444a] bg-[#1c2426]" />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#f87171]" />
                    Sold / booked
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'companies' && (
        <div className="card-2 mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="label-xs px-5 py-3">Company</th>
                <th className="label-xs px-3 py-3">Owner</th>
                <th className="label-xs px-3 py-3">Contact</th>
                <th className="label-xs px-3 py-3">Status</th>
                <th className="label-xs px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c._id} className="border-t border-[#1a2123]">
                  <td className="px-5 py-3 text-[13px] font-semibold">{c.name}</td>
                  <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{c.ownerName}</td>
                  <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">
                    {c.email}
                    <span className="block text-[11px] text-[#78868a]">{c.phone}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold ${
                        c.status === 'approved'
                          ? 'bg-[#34d399]/[0.13] text-[#34d399]'
                          : c.status === 'suspended'
                          ? 'bg-[#f87171]/[0.12] text-[#f87171]'
                          : 'bg-[#f5a524]/[0.13] text-[#f5a524]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="space-x-3 px-5 py-3 text-right">
                    {c.status !== 'approved' && (
                      <button type="button" onClick={() => handleCompanyStatus(c._id, 'approved')} className="text-[13px] font-semibold text-[#34d399] hover:underline">
                        Approve
                      </button>
                    )}
                    {c.status !== 'suspended' && (
                      <button type="button" onClick={() => handleCompanyStatus(c._id, 'suspended')} className="text-[13px] font-semibold text-[#f87171] hover:underline">
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#8e9a9d]">
                    No companies registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
