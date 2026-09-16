'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function BookingPage() {
  const router = useRouter()
  const [selectedBus, setSelectedBus] = useState(null)
  const [selectedSeats, setSelectedSeats] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('bkash')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const bus = localStorage.getItem('selectedBus')
    if (bus) setSelectedBus(JSON.parse(bus))
  }, [])

  const toggleSeat = (seatNum) => {
    if (selectedSeats.includes(seatNum)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNum))
    } else {
      setSelectedSeats([...selectedSeats, seatNum])
    }
  }

  const handlePayment = async () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat')
      return
    }

    setLoading(true)
    const total = selectedSeats.length * selectedBus.price

    setTimeout(() => {
      localStorage.setItem('bookingData', JSON.stringify({
        bus: selectedBus.name,
        from: 'Dhaka',
        to: 'Chittagong',
        date: new Date().toISOString().split('T')[0],
        seats: selectedSeats,
        total: total,
        payment: paymentMethod,
      }))

      toast.success('Payment successful!')
      router.push('/confirmation')
      setLoading(false)
    }, 2000)
  }

  if (!selectedBus) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Select Your Seats</h1>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Bus Layout (48 Seats)</h2>
              
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 48 }, (_, i) => i + 1).map((seatNum) => (
                  <button
                    key={seatNum}
                    onClick={() => toggleSeat(seatNum)}
                    className={`p-3 rounded font-bold transition ${
                      selectedSeats.includes(seatNum)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-900 hover:bg-blue-300'
                    }`}
                  >
                    {seatNum}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 rounded"></div>
                  <span>Selected</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 h-fit">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Summary</h3>
            
            <div className="mb-4">
              <p className="text-gray-600">Bus: {selectedBus.name}</p>
              <p className="text-gray-600">Seats: {selectedSeats.join(', ') || 'None selected'}</p>
              <p className="text-gray-600">Price/Seat: ৳{selectedBus.price}</p>
            </div>

            <div className="border-t pt-4 mb-4">
              <p className="text-2xl font-bold text-blue-600">
                ৳{selectedSeats.length * selectedBus.price}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-900">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading || selectedSeats.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
            >
              {loading ? 'Processing...' : 'Confirm & Pay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
