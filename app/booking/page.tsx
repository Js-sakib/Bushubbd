'use client';

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
