'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    passengers: '1',
  })

  const cities = [
    'Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 
    'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur'
  ]

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSearch = (e: any) => {
    e.preventDefault()
    
    if (!formData.from || !formData.to || !formData.date) {
      toast.error('Please fill all fields')
      return
    }
    
    if (formData.from === formData.to) {
      toast.error('From and To cities must be different')
      return
    }

    const params = new URLSearchParams({
      from: formData.from,
      to: formData.to,
      date: formData.date,
    })
    router.push(`/search?${params}`)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-blue-500 to-blue-600 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-5xl font-bold mb-4">Book Bus Tickets Online</h1>
        <p className="text-xl mb-8 opacity-90">Fast, Secure, Reliable. Travel Anywhere in Bangladesh.</p>

        <div className="bg-white rounded-lg shadow-2xl p-8 text-gray-900">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">From</label>
                <select
                  name="from"
                  value={formData.from}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select city</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">To</label>
                <select
                  name="to"
                  value={formData.to}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select city</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  min={today}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Passengers</label>
                <select
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition text-lg"
            >
              🔍 Search Buses
            </button>
          </form>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white bg-opacity-20 backdrop-blur p-6 rounded-lg">
            <div className="text-4xl mb-2">⚡</div>
            <h3 className="text-xl font-bold mb-2">Instant Booking</h3>
            <p>Get your ticket in seconds</p>
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur p-6 rounded-lg">
            <div className="text-4xl mb-2">🛡️</div>
            <h3 className="text-xl font-bold mb-2">100% Secure</h3>
            <p>Safe payment with bKash & Nagad</p>
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur p-6 rounded-lg">
            <div className="text-4xl mb-2">📱</div>
            <h3 className="text-xl font-bold mb-2">QR Tickets</h3>
            <p>Digital tickets on WhatsApp instantly</p>
          </div>
        </div>
      </div>
    </div>
  )
}
