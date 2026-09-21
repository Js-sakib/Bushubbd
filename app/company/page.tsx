'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'
import { generateSeatLabels } from '@/lib/seats'

interface Bus {
  _id: string
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
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  companyPayout: number
  passengerName: string
  passengerPhone: string
  paymentStatus: string
  status: string
}

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']

export default function CompanyDashboard() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [companyEmail, setCompanyEmail] = useState('')
  const [tab, setTab] = useState<'buses' | 'bookings'>('buses')

  const [buses, setBuses] = useState<Bus[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [manageSeatsBusId, setManageSeatsBusId] = useState<string | null>(null)

  const [form, setForm] = useState({
    busName: '', busType: 'AC', from: '', to: '',
    date: '', departureTime: '', arrivalTime: '', price: '', totalSeats: '40',
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== 'company') {
          router.push(companyPath('/company/login'))
        } else {
          setCompanyEmail(data.email)
          setChecking(false)
          loadAll(data.companyId)
        }
      })
  }, [])

  const loadAll = (companyId: string) => {
    fetch(`/api/buses?companyId=${companyId}`).then((r) => r.json()).then((d) => setBuses(d.buses || []))
    fetch('/api/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || []))
  }

  const reload = () => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => loadAll(d.companyId))
  }

  const handleLogout = async () => {
    await fetch('/api/company/login', { method: 'DELETE' })
    router.push(companyPath('/company/login'))
  }

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/buses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: Number(form.price), totalSeats: Number(form.totalSeats) }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add bus')
      return
    }
    toast.success('Bus added')
    setForm({ ...form, from: '', to: '', date: '', departureTime: '', arrivalTime: '', price: '' })
    reload()
  }

  const handleToggleSeat = async (bus: Bus, seatLabel: string) => {
    const isBooked = bus.bookedSeats?.includes(seatLabel)
    const res = await fetch(`/api/buses/${bus._id}/seats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: [seatLabel], action: isBooked ? 'release' : 'book' }),
    })
    if (res.ok) reload()
    else toast.error('Failed to update seat')
  }

  const handleDeleteBus = async (id: string) => {
    if (!confirm('Remove this bus?')) return
    const res = await fetch(`/api/buses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Bus removed')
      reload()
    } else {
      toast.error('Failed to remove bus')
    }
  }

  if (checking) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking access...</div>
  }

  const paid = bookings.filter((b) => b.paymentStatus === 'paid' && b.status === 'confirmed')
  const totalPayout = paid.reduce((sum, b) => sum + (b.companyPayout || 0), 0)

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 border-b border-[#1b2325] pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
        <div className="flex grow flex-col gap-0.5">
          <h1 className="display text-[19px] font-bold leading-tight">Operator dashboard</h1>
          <span className="text-[11.5px] text-[#78868a]">{companyEmail}</span>
        </div>
        <button type="button" onClick={handleLogout} className="chip">
          Logout
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#12756c] to-[#0e5a54] p-4">
          <span className="text-[11.5px] font-bold text-[#b8ede6]">Tickets sold</span>
          <span className="display text-3xl font-bold leading-none text-white">{paid.length}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-[#c77a0e] to-[#a25f06] p-4">
          <span className="text-[11.5px] font-bold text-[#fae3bc]">Your payout</span>
          <span className="display text-[26px] font-bold leading-tight text-white">৳{totalPayout.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {(['buses', 'bookings'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? 'chip-active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'buses' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="card-2 p-5">
            <h2 className="display mb-4 text-[15px] font-bold">Add a bus</h2>
            <form onSubmit={handleAddBus} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input required placeholder="Bus name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} className="input-dark" />
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
                  <th className="label-xs px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b._id} className="border-t border-[#1a2123]">
                    <td className="px-5 py-3 text-[13px] font-semibold">{b.busName}</td>
                    <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.from} → {b.to}</td>
                    <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.date} {b.departureTime}</td>
                    <td className="px-3 py-3 text-right text-[13px] font-bold">৳{b.price}</td>
                    <td className="px-3 py-3 text-right text-[13px]">
                      {b.totalSeats - (b.bookedSeats?.length || 0)}/{b.totalSeats}
                    </td>
                    <td className="space-x-3 px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setManageSeatsBusId(manageSeatsBusId === b._id ? null : b._id)}
                        className="text-[13px] font-semibold text-[#f5a524] hover:underline"
                      >
                        {manageSeatsBusId === b._id ? 'Close' : 'Manage seats'}
                      </button>
                      <button type="button" onClick={() => handleDeleteBus(b._id)} className="text-[13px] font-semibold text-[#f87171] hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {buses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#8e9a9d]">
                      You haven&apos;t added any buses yet.
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
                    Tap a seat to mark it sold (counter or phone sale) or release it back to available.
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
                            ? 'border border-dashed border-[#7a3230] bg-[#3a1a1a] text-[#d98a86] hover:bg-[#4a2020]'
                            : 'border border-[#2a6b52] bg-[#12372c] text-[#7de3b8] hover:bg-[#16452f]'
                        }`}
                      >
                        {seatLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="card-2 mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="label-xs px-5 py-3">Route</th>
                <th className="label-xs px-3 py-3">Date &amp; time</th>
                <th className="label-xs px-3 py-3">Passenger</th>
                <th className="label-xs px-3 py-3">Seats</th>
                <th className="label-xs px-3 py-3 text-right">Ticket</th>
                <th className="label-xs px-5 py-3 text-right">Your payout</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-t border-[#1a2123]">
                  <td className="px-5 py-3 text-[13px] font-semibold">{b.from} → {b.to}</td>
                  <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">{b.date} · {b.departureTime}</td>
                  <td className="px-3 py-3 text-[12.5px] text-[#a8b3b6]">
                    {b.passengerName}
                    <span className="block text-[11px] text-[#78868a]">{b.passengerPhone}</span>
                  </td>
                  <td className="px-3 py-3 text-[12.5px]">{b.seats.join(', ')}</td>
                  <td className="px-3 py-3 text-right text-[13px]">৳{b.totalPrice}</td>
                  <td className="px-5 py-3 text-right text-[13px] font-bold text-[#34d399]">
                    ৳{b.companyPayout ?? b.totalPrice}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#8e9a9d]">
                    No bookings yet.
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
