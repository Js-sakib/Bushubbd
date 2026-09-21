'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { generateSeatLabels } from '@/lib/seats'

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
    if (!busId) {
      setLoading(false)
      return
    }
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
      const payRes = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid', paymentMethod }),
      })
      if (!payRes.ok) {
        const payData = await payRes.json()
        toast.error(payData.error || 'Payment could not be confirmed')
        setSubmitting(false)
        return
      }

      toast.success('Booking confirmed')
      router.push(`/confirmation?bookingId=${bookingId}`)
    } catch {
      toast.error('Something went wrong, please try again')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#8e9a9d]">Loading bus details...</div>
  }

  if (!bus) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-[#9ba7aa]">Bus not found.</p>
        <button type="button" onClick={() => router.push('/')} className="glass-btn glass-btn-plain h-11 text-sm">
          Back to search
        </button>
      </div>
    )
  }

  const seatLabels = generateSeatLabels(bus.totalSeats)
  const rows: string[][] = []
  for (let i = 0; i < seatLabels.length; i += 4) {
    rows.push(seatLabels.slice(i, i + 4))
  }

  return (
    <div className="px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step === 'seats' ? router.back() : setStep(step === 'payment' ? 'details' : 'seats'))}
          aria-label="Go back"
          className="icon-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M19 12H6" />
            <path d="m11.5 5.5-6 6.5 6 6.5" />
          </svg>
        </button>
        <div className="flex grow flex-col gap-0.5">
          <span className="display text-[17px] font-bold">{bus.busName}</span>
          <span className="text-xs text-[#8e9a9d]">
            {bus.from} → {bus.to} · {bus.departureTime} · {bus.date}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {(['seats', 'details', 'payment'] as const).map((s) => (
          <span
            key={s}
            className={`h-1.5 grow rounded-full ${step === s ? 'bg-[#f2661d]' : 'bg-[#242d30]'}`}
          />
        ))}
      </div>

      {step === 'seats' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-[14px] border border-[#1f2729] bg-[#12181a] px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-[#c4cdcf]">
              <span className="h-3.5 w-3.5 rounded border border-[#38444a] bg-[#1c2426]" />
              Free
            </span>
            <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-[#c4cdcf]">
              <span className="h-3.5 w-3.5 rounded bg-gradient-to-br from-[#f2661d] to-[#f5a524]" />
              Yours
            </span>
            <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-[#c4cdcf]">
              <span className="h-3.5 w-3.5 rounded border border-dashed border-[#4a585c] bg-[#262e31]" />
              Taken
            </span>
          </div>

          <div className="rounded-[22px] border border-[#202a2d] bg-[#10171a] p-4">
            <div className="flex items-center justify-between border-b border-dashed border-[#263033] pb-3">
              <span className="label-xs">Deck</span>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8e9a9d]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
                  <circle cx="12" cy="12" r="7.5" />
                  <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" />
                </svg>
                Driver
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-2.5">
                  <span className="w-4 shrink-0 text-[11px] font-bold text-[#6e7b7e]">{rowIndex + 1}</span>
                  {row.slice(0, 2).map((seat) => {
                    const isBooked = bus.bookedSeats?.includes(seat)
                    const isSelected = selectedSeats.includes(seat)
                    return (
                      <button
                        key={seat}
                        type="button"
                        disabled={isBooked}
                        onClick={() => toggleSeat(seat)}
                        className={`h-9 min-w-0 grow basis-0 rounded-[9px] text-[11.5px] font-bold transition ${
                          isBooked
                            ? 'cursor-not-allowed border border-dashed border-[#4a585c] bg-[#262e31] text-[#737f82]'
                            : isSelected
                            ? 'border border-[#f5a524] bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#170b02]'
                            : 'border border-[#38444a] bg-[#1c2426] text-[#d6dee0] hover:border-[#f5a524]'
                        }`}
                      >
                        {seat}
                      </button>
                    )
                  })}
                  <span className="w-5 shrink-0" />
                  {row.slice(2, 4).map((seat) => {
                    const isBooked = bus.bookedSeats?.includes(seat)
                    const isSelected = selectedSeats.includes(seat)
                    return (
                      <button
                        key={seat}
                        type="button"
                        disabled={isBooked}
                        onClick={() => toggleSeat(seat)}
                        className={`h-9 min-w-0 grow basis-0 rounded-[9px] text-[11.5px] font-bold transition ${
                          isBooked
                            ? 'cursor-not-allowed border border-dashed border-[#4a585c] bg-[#262e31] text-[#737f82]'
                            : isSelected
                            ? 'border border-[#f5a524] bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#170b02]'
                            : 'border border-[#38444a] bg-[#1c2426] text-[#d6dee0] hover:border-[#f5a524]'
                        }`}
                      >
                        {seat}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] border border-[#232c2f] bg-[#151b1d] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-[#8e9a9d]">
                {selectedSeats.length} seat{selectedSeats.length === 1 ? '' : 's'}
                {selectedSeats.length > 0 ? ` · ${selectedSeats.join(', ')}` : ''}
              </span>
              <span className="display text-[22px] font-bold text-[#f5a524]">৳{totalPrice}</span>
            </div>
            <button type="button" onClick={handleConfirmSeats} className="glass-btn w-full">
              <span className="icon-disc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 12h13" />
                  <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
                </svg>
              </span>
              Continue
            </button>
            <span className="text-center text-[11.5px] text-[#78868a]">
              Seats are held for 10 minutes while you pay.
            </span>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">Passenger details</h2>
            <p className="mt-1 text-[12.5px] text-[#9ba7aa]">No account needed — just your contact details.</p>
          </div>

          <div className="flex flex-col gap-3.5 rounded-[18px] border border-[#232c2f] bg-[#151b1d] p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="label-xs">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={passenger.name}
                onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
                className="input-dark"
                placeholder="Your full name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="label-xs">
                Phone (WhatsApp)
              </label>
              <input
                id="phone"
                type="tel"
                value={passenger.phone}
                onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
                className="input-dark"
                placeholder="8801XXXXXXXXX"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="label-xs">
                Email (optional)
              </label>
              <input
                id="email"
                type="email"
                value={passenger.email}
                onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
                className="input-dark"
                placeholder="you@example.com"
              />
            </div>
            <button type="button" onClick={handleConfirmDetails} className="glass-btn w-full">
              <span className="icon-disc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 12h13" />
                  <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
                </svg>
              </span>
              Continue to payment
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="mt-5 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Payment</h2>

          <div className="flex flex-col gap-4 rounded-[18px] border border-[#232c2f] bg-[#151b1d] p-4">
            <div className="rounded-2xl border border-[#2a3437] bg-[#0f1517] p-4">
              <p className="text-[12.5px] text-[#8e9a9d]">Total amount</p>
              <p className="display mt-1 text-[32px] font-bold leading-none text-[#f5a524]">৳{totalPrice}</p>
              <p className="mt-2 text-xs text-[#8e9a9d]">Seats: {selectedSeats.join(', ')}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 ${
                  paymentMethod === 'bkash' ? 'border-[#f2661d] bg-[#f2661d]/10' : 'border-[#2a3437] bg-[#0f1517]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'bkash'}
                  onChange={() => setPaymentMethod('bkash')}
                  className="h-4 w-4 accent-[#f2661d]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">bKash</span>
                  <span className="text-xs text-[#8e9a9d]">Instant payment</span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 ${
                  paymentMethod === 'nagad' ? 'border-[#f2661d] bg-[#f2661d]/10' : 'border-[#2a3437] bg-[#0f1517]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'nagad'}
                  onChange={() => setPaymentMethod('nagad')}
                  className="h-4 w-4 accent-[#f2661d]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">Nagad</span>
                  <span className="text-xs text-[#8e9a9d]">Instant payment</span>
                </span>
              </label>
            </div>

            <button type="button" onClick={handlePayment} disabled={submitting} className="glass-btn w-full">
              <span className="icon-disc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="2.5" y="6" width="19" height="13" rx="3" />
                  <path d="M2.5 10.5h19" />
                </svg>
              </span>
              {submitting ? 'Processing...' : `Pay ৳${totalPrice}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#8e9a9d]">Loading...</div>}>
      <BookingContent />
    </Suspense>
  )
}
