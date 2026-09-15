// FILE 1: app/layout.tsx
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'BusHub - Book Bus Tickets Online',
  description: 'Fast & secure bus ticket booking in Bangladesh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold text-blue-600">🚌 BusHub</div>
            <div className="text-sm text-gray-600">24/7 Support: WhatsApp</div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="bg-gray-900 text-white mt-16 py-8 text-center">
          <p>© 2024 BusHub Bangladesh | Fast • Secure • Reliable</p>
        </footer>

        <Toaster position="top-center" />
      </body>
    </html>
  )
}

// FILE 2: app/page.tsx
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
                    <option key={num} value={num}>{num} Passenger{num > 1 ? 's' : ''}</option>
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

          <p className="text-center text-sm text-gray-600 mt-4">
            ✅ Lowest prices | 🚌 100+ operators | 📱 Instant confirmation
          </p>
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

// FILE 3: app/search/page.tsx
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [buses, setBuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const date = searchParams.get('date')

  const mockBuses = [
    {
      id: '1',
      name: 'Green Line',
      type: 'AC',
      price: 850,
      departure: '10:00 PM',
      arrival: '6:00 AM',
      duration: '8h',
      availableSeats: 15,
      rating: 4.8,
    },
    {
      id: '2',
      name: 'Shyamoli Paribahan',
      type: 'Non-AC',
      price: 650,
      departure: '11:00 PM',
      arrival: '7:00 AM',
      duration: '8h',
      availableSeats: 20,
      rating: 4.5,
    },
    {
      id: '3',
      name: 'Hanif Enterprise',
      type: 'Luxury AC',
      price: 1200,
      departure: '9:00 PM',
      arrival: '5:00 AM',
      duration: '8h',
      availableSeats: 8,
      rating: 4.9,
    },
  ]

  useEffect(() => {
    setTimeout(() => {
      setBuses(mockBuses)
      setLoading(false)
    }, 500)
  }, [from, to, date])

  const handleSelectBus = (bus: any) => {
    router.push(`/booking?busId=${bus.id}&date=${date}&from=${from}&to=${to}`)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-xl font-bold mb-2">Search Results</h2>
        <p className="text-gray-700">{from} → {to} | {new Date(date!).toLocaleDateString()}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : buses.length > 0 ? (
        <div className="space-y-4">
          {buses.map((bus) => (
            <div key={bus.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{bus.name}</h3>
                  <p className="text-sm text-gray-600">{bus.type} Bus</p>

                  <div className="mt-3 flex gap-6">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{bus.departure}</p>
                      <p className="text-xs text-gray-500">Departure</p>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <div className="flex-1 border-t-2 border-dashed"></div>
                      <span className="px-2 text-xs">{bus.duration}</span>
                      <div className="flex-1 border-t-2 border-dashed"></div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{bus.arrival}</p>
                      <p className="text-xs text-gray-500">Arrival</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">৳{bus.price}</p>
                    <p className="text-xs text-gray-500">{bus.availableSeats} seats available</p>
                  </div>

                  <div className="flex items-center gap-1 text-yellow-500">
                    {'★'.repeat(Math.floor(bus.rating))}
                    <span className="text-sm text-gray-600">({bus.rating})</span>
                  </div>

                  <button
                    onClick={() => handleSelectBus(bus)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">No buses found</p>
        </div>
      )}
    </div>
  )
}

// FILE 4: app/booking/page.tsx
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function BookingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const busId = searchParams.get('busId')
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [step, setStep] = useState<'seats' | 'payment'>('seats')

  const totalPrice = selectedSeats.length * 800

  const handleSelectSeat = (seatNum: number) => {
    if (selectedSeats.includes(seatNum)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNum))
    } else {
      setSelectedSeats([...selectedSeats, seatNum])
    }
  }

  const handleConfirmSeats = () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat')
      return
    }
    setStep('payment')
  }

  const handlePayment = () => {
    toast.success('Booking confirmed!')
    setTimeout(() => {
      router.push(`/confirmation?bookingId=BH-${Date.now()}`)
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between mb-8">
        <div className={`flex-1 ${step === 'seats' ? 'bg-blue-600' : 'bg-gray-300'} h-2`}></div>
        <div className={`flex-1 ${step === 'payment' ? 'bg-blue-600' : 'bg-gray-300'} h-2 ml-2`}></div>
      </div>

      {step === 'seats' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Select Your Seats</h2>
          
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-sm text-gray-600 mb-4">Click seats to select (AC - Non-AC)</p>
            <div className="grid grid-cols-4 gap-2 max-w-md mb-4">
              {Array.from({ length: 48 }).map((_, i) => {
                const seatNum = i + 1
                const isSelected = selectedSeats.includes(seatNum)
                const isBooked = Math.random() > 0.8
                
                return (
                  <button
                    key={seatNum}
                    onClick={() => !isBooked && handleSelectSeat(seatNum)}
                    disabled={isBooked}
                    className={`p-2 rounded text-xs font-bold transition ${
                      isBooked
                        ? 'bg-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-100 hover:bg-blue-200'
                    }`}
                  >
                    {seatNum}
                  </button>
                )
              })}
            </div>
            
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300"></div>
                <span>Booked</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
            <div>
              <p className="text-gray-600">Selected: {selectedSeats.length} seats</p>
              <p className="text-3xl font-bold text-blue-600">৳{totalPrice}</p>
            </div>
            <button
              onClick={handleConfirmSeats}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold"
            >
              Continue to Payment
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Payment</h2>
          
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-gray-600 mb-2">Total Amount</p>
              <p className="text-4xl font-bold text-blue-600">৳{totalPrice}</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center p-4 border-2 border-pink-500 rounded-lg cursor-pointer bg-pink-50">
                <input type="radio" defaultChecked className="w-4 h-4" />
                <span className="ml-3">
                  <span className="font-bold text-pink-600">bKash</span>
                  <p className="text-sm text-gray-600">Instant payment • No fees</p>
                </span>
              </label>

              <label className="flex items-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" className="w-4 h-4" />
                <span className="ml-3">
                  <span className="font-bold">Nagad</span>
                  <p className="text-sm text-gray-600">Instant payment • No fees</p>
                </span>
              </label>
            </div>

            <button
              onClick={handlePayment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition text-lg"
            >
              Pay ৳{totalPrice} Now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// FILE 5: app/confirmation/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode.react'

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-green-50 border-l-4 border-green-600 p-6 mb-8">
        <div className="flex">
          <div className="text-3xl mr-4">✅</div>
          <div>
            <h2 className="text-2xl font-bold text-green-900">Booking Confirmed!</h2>
            <p className="text-green-700">Your ticket has been sent to your WhatsApp</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 border-2 border-gray-200 rounded-lg">
            <QRCode value={bookingId || 'BUSHUB-000'} size={200} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-gray-600">Booking ID</p>
            <p className="text-2xl font-mono font-bold">{bookingId}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Bus Operator</p>
              <p className="font-bold">Green Line Paribahan</p>
            </div>
            <div>
              <p className="text-gray-600">Bus Type</p>
              <p className="font-bold">AC</p>
            </div>
            <div>
              <p className="text-gray-600">Departure</p>
              <p className="font-bold">10:00 PM</p>
            </div>
            <div>
              <p className="text-gray-600">Seats</p>
              <p className="font-bold">12A, 12B</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-gray-600 mb-2">Total Amount Paid</p>
            <p className="text-3xl font-bold text-blue-600">৳1,600</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="font-bold mb-3">📋 What's Next?</h3>
        <ul className="space-y-2 text-sm">
          <li>✅ Show your QR code to the bus conductor</li>
          <li>✅ Arrive 30 minutes before departure</li>
          <li>✅ Keep your booking ID handy</li>
          <li>✅ Check your WhatsApp for reminders</li>
        </ul>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <button
          onClick={() => window.print()}
          className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
        >
          🖨️ Print Ticket
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
        >
          🏠 Book Another Ticket
        </button>
      </div>
    </div>
  )
}

// FILE 6: app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

input, select, textarea {
  font-family: inherit;
}
