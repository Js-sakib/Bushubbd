'use client'

import { useState, useEffect } from 'react'

export default function Confirmation() {
  const [bookingData, setBookingData] = useState<any>(null)

  useEffect(() => {
    const data = localStorage.getItem('bookingData')
    if (data) setBookingData(JSON.parse(data))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 text-gray-900 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-green-600 mb-4">✅ Booking Confirmed!</h1>
          <p className="text-xl text-gray-700 mb-6">Your ticket has been booked successfully</p>
          
          {bookingData && (
            <div className="bg-gray-100 p-6 rounded-lg mb-6 text-left">
              <p className="mb-2"><strong>Bus:</strong> {bookingData.bus}</p>
              <p className="mb-2"><strong>From:</strong> {bookingData.from}</p>
              <p className="mb-2"><strong>To:</strong> {bookingData.to}</p>
              <p className="mb-2"><strong>Date:</strong> {bookingData.date}</p>
              <p className="mb-2"><strong>Seats:</strong> {bookingData.seats?.join(', ')}</p>
              <p className="mb-2"><strong>Total:</strong> ৳{bookingData.total}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold mb-3">📋 What's Next?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ Show your QR code to the bus conductor</li>
              <li>✅ Arrive 30 minutes before departure</li>
              <li>✅ Keep your booking ID handy</li>
              <li>✅ Check your WhatsApp for reminders</li>
            </ul>
          </div>

          <p className="text-gray-600 mb-4">Your QR ticket will be sent via WhatsApp shortly</p>
          <p className="text-sm text-gray-500">Booking ID: BH{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          
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
