'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Booking {
  bookingCode: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  passengerName: string
  paymentStatus: string
  status: string
  qrCode: string
  validUntil: string
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided')
      setLoading(false)
      return
    }
    fetch(`/api/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setBooking(data.booking)
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading your ticket...</p>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Booking Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/" className="text-blue-600 hover:underline">← Back to Home</a>
        </div>
      </div>
    )
  }

  const expiryDate = new Date(booking.validUntil)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 text-gray-900 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-green-600 mb-4">✅ Booking Confirmed!</h1>
          <p className="text-xl text-gray-700 mb-6">Hi {booking.passengerName}, your ticket is ready</p>

          {booking.qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booking.qrCode} alt="Ticket QR Code" className="mx-auto mb-6 w-40 h-40" />
          )}

          <div className="bg-gray-100 p-6 rounded-lg mb-6 text-left">
            <p className="mb-2"><strong>Bus:</strong> {booking.busName} ({booking.companyName})</p>
            <p className="mb-2"><strong>From:</strong> {booking.from}</p>
            <p className="mb-2"><strong>To:</strong> {booking.to}</p>
            <p className="mb-2"><strong>Date:</strong> {booking.date} · {booking.departureTime}</p>
            <p className="mb-2"><strong>Seats:</strong> {booking.seats.join(', ')}</p>
            <p className="mb-2"><strong>Total:</strong> ৳{booking.totalPrice}</p>
            <p className="mb-2">
              <strong>Payment:</strong>{' '}
              <span className={booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}>
                {booking.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-bold mb-3">📋 What's Next?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ Show this QR code to the bus conductor</li>
              <li>✅ Arrive 30 minutes before departure</li>
              <li>✅ Keep your booking code handy</li>
              <li>⏳ Valid until {expiryDate.toLocaleString()}</li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 mb-4">Booking Code: <strong>{booking.bookingCode}</strong></p>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => window.print()}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              🖨️ Print Ticket
            </button>
            <a href="/" className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition text-center">
              🏠 Book Another Ticket
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Confirmation() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
