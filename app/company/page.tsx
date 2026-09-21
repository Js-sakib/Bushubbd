'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { companyPath } from '@/lib/panelNav'
import { generateSeatLabels } from '@/lib/seats'
import toast from 'react-hot-toast'

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
    fetch('/api/auth/me').then((r) => r.json()).then((d) => loadAll(d.companyId))
  }

  const handleToggleSeat = async (bus: Bus, seatLabel: string) => {
    const isBooked = bus.bookedSeats?.includes(seatLabel)
    const res = await fetch(`/api/buses/${bus._id}/seats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: [seatLabel], action: isBooked ? 'release' : 'book' }),
    })
    if (res.ok) {
      fetch('/api/auth/me').then((r) => r.json()).then((d) => loadAll(d.companyId))
    } else {
      toast.error('Failed to update seat')
    }
  }

  const handleDeleteBus = async (id: string) => {
    const res = await fetch(`/api/buses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Bus removed')
      fetch('/api/auth/me').then((r) => r.json()).then((d) => loadAll(d.companyId))
    } else {
      toast.error('Failed to remove bus')
    }
  }

  if (checking) {
    return <div className="text-center py-16 text-gray-500">Checking access...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
          <p className="text-sm text-gray-500">{companyEmail}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['buses', 'bookings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'buses' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-bold text-lg mb-4">Add a Bus</h2>
            <form onSubmit={handleAddBus} className="grid md:grid-cols-3 gap-4">
              <input required placeholder="Bus Name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} className="border rounded-lg px-3 py-2" />
              <select value={form.busType} onChange={(e) => setForm({ ...form, busType: e.target.value })} className="border rounded-lg px-3 py-2">
                <option>AC</option>
                <option>Non-AC</option>
                <option>Sleeper</option>
              </select>
              <select required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="border rounded-lg px-3 py-2">
                <option value="">From</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="border rounded-lg px-3 py-2">
                <option value="">To</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input required type="time" placeholder="Departure" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input type="time" placeholder="Arrival" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input required type="number" placeholder="Price (৳)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input required type="number" placeholder="Total Seats" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} className="border rounded-lg px-3 py-2" />
              <button type="submit" className="md:col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">Add Bus</button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Bus</th><th className="p-3">Route</th><th className="p-3">Date/Time</th>
                  <th className="p-3">Price</th><th className="p-3">Seats</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b._id} className="border-t">
                    <td className="p-3">{b.busName}</td>
                    <td className="p-3">{b.from} → {b.to}</td>
                    <td className="p-3">{b.date} {b.departureTime}</td>
                    <td className="p-3">৳{b.price}</td>
                    <td className="p-3">{b.totalSeats - (b.bookedSeats?.length || 0)}/{b.totalSeats}</td>
                    <td className="p-3 space-x-3">
                      <button
                        onClick={() => setManageSeatsBusId(manageSeatsBusId === b._id ? null : b._id)}
                        className="text-blue-600 hover:underline"
                      >
                        {manageSeatsBusId === b._id ? 'Close' : 'Manage Seats'}
                      </button>
                      <button onClick={() => handleDeleteBus(b._id)} className="text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
                {buses.length === 0 && (
                  <tr><td className="p-4 text-gray-500" colSpan={6}>You haven't added any buses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {manageSeatsBusId && (() => {
            const bus = buses.find((b) => b._id === manageSeatsBusId)
            if (!bus) return null
            return (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold mb-1">{bus.busName} · {bus.from} → {bus.to} ({bus.date})</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Tap a seat to mark it sold (e.g. counter or phone sale) or release it back to available. This updates the customer website instantly.
                </p>
                <div className="grid grid-cols-8 md:grid-cols-12 gap-2 max-w-2xl mb-4">
                  {generateSeatLabels(bus.totalSeats).map((seatLabel) => {
                    const isBooked = bus.bookedSeats?.includes(seatLabel)
                    return (
                      <button
                        key={seatLabel}
                        onClick={() => handleToggleSeat(bus, seatLabel)}
                        className={`p-2 rounded text-xs font-bold transition ${
                          isBooked ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-100 hover:bg-green-200'
                        }`}
                      >
                        {seatLabel}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100"></div><span>Available</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500"></div><span>Sold / Booked</span></div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4 max-w-xs">
            <p className="text-xs text-gray-500">Your Total Payout (paid bookings)</p>
            <p className="text-xl font-bold text-green-600">
              ৳{bookings.filter((b) => b.paymentStatus === 'paid').reduce((sum, b) => sum + (b.companyPayout || 0), 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Code</th><th className="p-3">Passenger</th><th className="p-3">Route</th>
                  <th className="p-3">Seats</th><th className="p-3">Ticket Total</th><th className="p-3">Your Payout</th><th className="p-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id} className="border-t">
                    <td className="p-3">{b.bookingCode}</td>
                    <td className="p-3">{b.passengerName}<br /><span className="text-xs text-gray-500">{b.passengerPhone}</span></td>
                    <td className="p-3">{b.from} → {b.to} ({b.date})</td>
                    <td className="p-3">{b.seats.join(', ')}</td>
                    <td className="p-3">৳{b.totalPrice}</td>
                    <td className="p-3 font-medium text-green-700">৳{b.companyPayout ?? b.totalPrice}</td>
                    <td className="p-3">{b.paymentStatus}</td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td className="p-4 text-gray-500" colSpan={7}>No bookings yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
