'use client'

import { useSearchParams } from 'next/navigation'

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
            <p className="text-4xl">📱 QR Code Here</p>
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
