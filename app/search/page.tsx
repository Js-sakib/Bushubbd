'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Bus {
  _id: string
  companyName: string
  busName: string
  busType: string
  from: string
  to: string
  date: string
  departureTime: string
  arrivalTime: string
  price: number
  totalSeats: number
  bookedSeats: string[]
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const date = searchParams.get('date') || ''

  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to || !date) return
    setLoading(true)
    fetch(`/api/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setBuses(data.buses || [])
        }
      })
      .catch(() => setError('Failed to load buses'))
      .finally(() => setLoading(false))
  }, [from, to, date])

  return (
    <div className="min-h-[70vh]">
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {from} → {to}
        </h1>
        <p className="text-gray-600">{date}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          ← Modify Search
        </button>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-500">Searching buses...</div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-red-500">{error}</div>
      )}

      {!loading && !error && buses.length === 0 && (
        <div className="text-center bg-white rounded-lg shadow p-12">
          <div className="text-5xl mb-4">🚌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No buses found</h2>
          <p className="text-gray-600">Try a different date or route.</p>
        </div>
      )}

      <div className="space-y-4">
        {buses.map((bus) => {
          const seatsLeft = bus.totalSeats - (bus.bookedSeats?.length || 0)
          return (
            <div key={bus._id} className="bg-white rounded-lg shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{bus.busName}</h3>
                <p className="text-sm text-gray-500">{bus.companyName} · {bus.busType}</p>
                <p className="text-sm text-gray-700 mt-1">
                  🕐 {bus.departureTime} {bus.arrivalTime ? `→ ${bus.arrivalTime}` : ''}
                </p>
                <p className="text-sm text-gray-500">{seatsLeft} seats left</p>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                <div className="text-2xl font-bold text-blue-600">৳{bus.price}</div>
                <button
                  disabled={seatsLeft <= 0}
                  onClick={() => router.push(`/booking?busId=${bus._id}`)}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  {seatsLeft <= 0 ? 'Sold Out' : 'Select Seats'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Search() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-500">Loading...</div>}>
      <SearchResults />
    </Suspense>
  )
}
