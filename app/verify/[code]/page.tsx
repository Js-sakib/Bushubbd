'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

interface VerifyResult {
  valid: boolean
  reason?: string
  bookingCode: string
  passengerName: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  validUntil: string
  checkedIn: boolean
  checkedInAt?: string
}

const REASON_LABELS: Record<string, string> = {
  unpaid: 'Payment was never completed for this ticket',
  expired: 'This ticket has expired (24-hour window passed)',
  cancelled: 'This ticket was cancelled',
}

export default function VerifyTicket() {
  const params = useParams()
  const code = params.code as string

  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/verify/${code}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setResult(data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (code) load()
  }, [code])

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res = await fetch(`/api/verify/${code}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not check in')
        return
      }
      toast.success('Passenger checked in')
      load()
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Checking ticket...</div>
  }

  if (notFound || !result) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600">This QR code does not match any real BusHub ticket. It may be fake or edited.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className={`rounded-lg p-8 text-center border-2 ${result.valid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <div className="text-5xl mb-4">{result.valid ? '✅' : '❌'}</div>
        <h1 className={`text-2xl font-bold mb-2 ${result.valid ? 'text-green-700' : 'text-red-700'}`}>
          {result.valid ? 'Valid Ticket' : 'Not Valid'}
        </h1>
        {!result.valid && (
          <p className="text-gray-600 mb-4">{REASON_LABELS[result.reason || ''] || 'This ticket cannot be used.'}</p>
        )}
        {result.checkedIn && (
          <p className="text-sm text-orange-600 font-medium mb-4">
            ⚠️ Already checked in at {result.checkedInAt ? new Date(result.checkedInAt).toLocaleString() : ''}
          </p>
        )}

        <div className="bg-white rounded-lg p-6 text-left mt-4 space-y-2">
          <p><strong>Booking:</strong> {result.bookingCode}</p>
          <p><strong>Passenger:</strong> {result.passengerName}</p>
          <p><strong>Bus:</strong> {result.busName} ({result.companyName})</p>
          <p><strong>Route:</strong> {result.from} → {result.to}</p>
          <p><strong>Date:</strong> {result.date} · {result.departureTime}</p>
          <p><strong>Seats:</strong> {result.seats.join(', ')}</p>
          <p><strong>Expires:</strong> {new Date(result.validUntil).toLocaleString()}</p>
        </div>

        {result.valid && !result.checkedIn && (
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
          >
            {checkingIn ? 'Checking in...' : '✅ Check In Passenger'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center mt-4">
        This status is checked live against BusHub's database — it cannot be faked by editing an image.
      </p>
    </div>
  )
}
