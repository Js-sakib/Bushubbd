'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
}

function BookingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const busId = searchParams.get('busId')

  const [bus, setBus] = useState<Bus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [step, setStep] = useState<'seats' | 'details' | 'payment'>('seats')
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash')
  const [submitting, setSubmitting] = useState(false)
  const [passenger, setPassenger] = useState({ name: '', phone: '', email: '' })

  useEffect(() => {
    if (!busId) return
    fetch(`/api/buses/${busId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bus) setBus(data.bus)
        else toast.error(data.error || 'Bus not found')
      })
      .finally(() => setLoading(false))
  }, [busId])

  const totalPrice = bus ? selectedSeats.length * bus.price : 0

  const toggleSeat = (seatLabel: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatLabel) ? prev.filter((s) => s !== seatLabel) : [...prev, seatLabel]
    )
  }

  const handleConfirmSeats = () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat')
      return
    }
    setStep('details')
  }

  const handleConfirmDetails = () => {
    if (!passenger.name || !passenger.phone) {
      toast.error('Please enter your name and phone number')
      return
    }
    setStep('payment')
  }

  const handlePayment = async () => {
    if (!bus) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: bus._id,
          seats: selectedSeats,
          passengerName: passenger.name,
          passengerPhone: passenger.phone,
          passengerEmail: passenger.email || undefined,
          source: 'web',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Booking failed')
        setSubmitting(false)
        return
      }

      const bookingId = data.booking._id
      await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid', paymentMethod }),
      })

      toast.success('Booking confirmed!')
      router.push(`/confirmation?bookingId=${bookingId}`)
    } catch (err) {
      toast.error('Something went wrong, please try again')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading bus details...</div>
  }

  if (!bus) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 mb-4">Bus not found.</p>
        <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
          ← Back to Search
        </button>
      </div>
    )
  }

  const seatLabels = Array.from({ length: bus.totalSeats }, (_, i) => `${Math.floor(i / 4) + 1}${String.fromCharCode(65 + (i % 4))}`)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h1 className="font-bold text-lg text-gray-900">{bus.busName} · {bus.companyName}</h1>
        <p className="text-sm text-gray-600">{bus.from} → {bus.to} · {bus.date} · {bus.departureTime}</p>
      </div>

      <div className="flex justify-between mb-8 gap-2">
        <div className={`flex-1 ${step === 'seats' ? 'bg-blue-600' : 'bg-gray-300'} h-2 rounded`}></div>
        <div className={`flex-1 ${step === 'details' ? 'bg-blue-600' : 'bg-gray-300'} h-2 rounded`}></div>
        <div className={`flex-1 ${step === 'payment' ? 'bg-blue-600' : 'bg-gray-300'} h-2 rounded`}></div>
      </div>

      {step === 'seats' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Select Your Seats</h2>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-4 gap-2 max-w-md mb-4">
              {seatLabels.map((seatLabel) => {
                const isSelected = selectedSeats.includes(seatLabel)
                const isBooked = bus.bookedSeats?.includes(seatLabel)

                return (
                  <button
                    key={seatLabel}
                    onClick={() => !isBooked && toggleSeat(seatLabel)}
                    disabled={isBooked}
                    className={`p-2 rounded text-xs font-bold transition ${
                      isBooked
                        ? 'bg-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-100 hover:bg-blue-200'
                    }`}
                  >
                    {seatLabel}
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
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Passenger Details</h2>
          <p className="text-sm text-gray-500 mb-4">No account needed — just enter your contact details.</p>

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <input
                type="text"
                value={passenger.name}
                onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number (WhatsApp)</label>
              <input
                type="tel"
                value={passenger.phone}
                onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 8801XXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email (optional)</label>
              <input
                type="email"
                value={passenger.email}
                onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button onClick={() => setStep('seats')} className="text-gray-600 hover:underline">
                ← Back
              </button>
              <button
                onClick={handleConfirmDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold"
              >
                Continue to Payment
              </button>
            </div>
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
              <p className="text-sm text-gray-500 mt-2">Seats: {selectedSeats.join(', ')}</p>
            </div>

            <div className="space-y-3">
              <label
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer ${paymentMethod === 'bkash' ? 'border-pink-500 bg-pink-50' : 'border-gray-300'}`}
              >
                <input
                  type="radio"
                  checked={paymentMethod === 'bkash'}
                  onChange={() => setPaymentMethod('bkash')}
                  className="w-4 h-4"
                />
                <span className="ml-3">
                  <span className="font-bold text-pink-600">bKash</span>
                  <p className="text-sm text-gray-600">Instant payment</p>
                </span>
              </label>

              <label
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer ${paymentMethod === 'nagad' ? 'border-orange-500 bg-orange-50' : 'border-gray-300'}`}
              >
                <input
                  type="radio"
                  checked={paymentMethod === 'nagad'}
                  onChange={() => setPaymentMethod('nagad')}
                  className="w-4 h-4"
                />
                <span className="ml-3">
                  <span className="font-bold">Nagad</span>
                  <p className="text-sm text-gray-600">Instant payment</p>
                </span>
              </label>
            </div>

            <button
              onClick={handlePayment}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-lg transition text-lg"
            >
              {submitting ? 'Processing...' : `Pay ৳${totalPrice} Now`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><span>Loading...</span></div>}>
      <BookingContent />
    </Suspense>
  )
}
