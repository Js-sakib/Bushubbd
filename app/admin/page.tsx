'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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
  from: string
  to: string
  date: string
  seats: string[]
  totalPrice: number
  passengerName: string
  passengerPhone: string
  paymentStatus: string
  status: string
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

export default function AdminDashboard() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<'buses' | 'bookings' | 'companies'>('buses')

  const [buses, setBuses] = useState<Bus[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])

  const [form, setForm] = useState({
    busName: '', busType: 'AC', companyName: 'BusHub', from: '', to: '',
    date: '', departureTime: '', arrivalTime: '', price: '', totalSeats: '40',
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== 'admin') {
          router.push('/admin/login')
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
    router.push('/admin/login')
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
    return <div className="text-center py-16 text-gray-500">Checking access...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['buses', 'bookings', 'companies'] as const).map((t) => (
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
              <input placeholder="Operator Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="border rounded-lg px-3 py-2" />
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
                  <th className="p-3">Price</th><th className="p-3">Seats</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b._id} className="border-t">
                    <td className="p-3">{b.busName}<br /><span className="text-xs text-gray-500">{b.companyName}</span></td>
                    <td className="p-3">{b.from} → {b.to}</td>
                    <td className="p-3">{b.date} {b.departureTime}</td>
                    <td className="p-3">৳{b.price}</td>
                    <td className="p-3">{b.totalSeats - (b.bookedSeats?.length || 0)}/{b.totalSeats}</td>
                    <td className="p-3">{b.status}</td>
                  </tr>
                ))}
                {buses.length === 0 && (
                  <tr><td className="p-4 text-gray-500" colSpan={6}>No buses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Code</th><th className="p-3">Passenger</th><th className="p-3">Route</th>
                <th className="p-3">Seats</th><th className="p-3">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th>
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
                  <td className="p-3">{b.paymentStatus}</td>
                  <td className="p-3">{b.status}</td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td className="p-4 text-gray-500" colSpan={7}>No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'companies' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Company</th><th className="p-3">Owner</th><th className="p-3">Contact</th>
                <th className="p-3">Status</th><th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c._id} className="border-t">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">{c.ownerName}</td>
                  <td className="p-3">{c.email}<br /><span className="text-xs text-gray-500">{c.phone}</span></td>
                  <td className="p-3">{c.status}</td>
                  <td className="p-3 space-x-2">
                    {c.status !== 'approved' && (
                      <button onClick={() => handleCompanyStatus(c._id, 'approved')} className="text-green-600 hover:underline">Approve</button>
                    )}
                    {c.status !== 'suspended' && (
                      <button onClick={() => handleCompanyStatus(c._id, 'suspended')} className="text-red-600 hover:underline">Suspend</button>
                    )}
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td className="p-4 text-gray-500" colSpan={5}>No companies registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
