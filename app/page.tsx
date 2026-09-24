'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', "Cox's Bazar", 'Barishal', 'Rangpur']

const POPULAR_ROUTES = [
  { from: 'Dhaka', to: 'Sylhet' },
  { from: 'Dhaka', to: "Cox's Bazar" },
  { from: 'Dhaka', to: 'Chittagong' },
  { from: 'Dhaka', to: 'Rajshahi' },
]

export default function Home() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [trip, setTrip] = useState<'oneway' | 'round'>('oneway')
  const [formData, setFormData] = useState({ from: '', to: '', date: today, returnDate: '', passengers: '1' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const next = { ...formData, [e.target.name]: e.target.value }
    // A return date before the outbound date is never valid, so drag it along.
    if (e.target.name === 'date' && next.returnDate && next.returnDate < e.target.value) {
      next.returnDate = e.target.value
    }
    setFormData(next)
  }

  const handleSwap = () => {
    setFormData({ ...formData, from: formData.to, to: formData.from })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.from || !formData.to || !formData.date) {
      toast.error('Please fill all fields')
      return
    }
    if (formData.from === formData.to) {
      toast.error('From and To cities must be different')
      return
    }
    if (trip === 'round' && !formData.returnDate) {
      toast.error('Please choose your return date')
      return
    }

    const params = new URLSearchParams({
      from: formData.from,
      to: formData.to,
      date: formData.date,
      passengers: formData.passengers,
    })
    if (trip === 'round') {
      params.set('trip', 'round')
      params.set('returnDate', formData.returnDate)
    }
    router.push(`/search?${params}`)
  }

  const goToRoute = (from: string, to: string) => {
    const params = new URLSearchParams({
      from,
      to,
      date: formData.date || today,
      passengers: formData.passengers,
    })
    if (trip === 'round' && formData.returnDate) {
      params.set('trip', 'round')
      params.set('returnDate', formData.returnDate)
    }
    router.push(`/search?${params}`)
  }

  return (
    <div className="px-5 pb-4 pt-5">
      <section className="flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#f5a524]">
          Online bus tickets · Bangladesh
        </span>
        <h1 className="text-[36px] font-bold leading-[1.08] sm:text-5xl">
          Every seat,
          <br />
          one tap away.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-[#9ba7aa]">
          Live seat availability, payment with bKash or Nagad, and a QR ticket on WhatsApp the moment you pay.
        </p>
      </section>

      <form
        onSubmit={handleSearch}
        className="mt-6 flex flex-col gap-3.5 glass p-4 sm:max-w-xl"
      >
        <div
          role="radiogroup"
          aria-label="Trip type"
          className="flex gap-1 rounded-full border border-white/10 bg-black/30 p-1"
        >
          {(
            [
              { key: 'oneway', label: 'One way' },
              { key: 'round', label: 'Round trip' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={trip === option.key}
              onClick={() => setTrip(option.key)}
              className={`h-10 grow rounded-full text-[13px] font-bold transition ${
                trip === option.key
                  ? 'bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#170b02] shadow-[0_6px_16px_rgba(242,102,29,0.32)]'
                  : 'text-[#9ba7aa] hover:text-[#e8eef0]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-stretch gap-2.5">
          <div className="flex grow flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className="label-xs">
                From
              </label>
              <select id="from" name="from" value={formData.from} onChange={handleChange} className="input-dark">
                <option value="">Select city</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className="label-xs">
                To
              </label>
              <select id="to" name="to" value={formData.to} onChange={handleChange} className="input-dark">
                <option value="">Select city</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap origin and destination"
            className="h-11 w-11 shrink-0 self-center rounded-full border border-white/10 bg-white/[0.06] text-[#f5a524] transition hover:border-[#f5a524]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-[19px] w-[19px]">
              <path d="M7 4v16" />
              <path d="M3.5 7.5 7 4l3.5 3.5" />
              <path d="M17 20V4" />
              <path d="M13.5 16.5 17 20l3.5-3.5" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date" className="label-xs">
              {trip === 'round' ? 'Going' : 'Date'}
            </label>
            <input id="date" name="date" type="date" min={today} value={formData.date} onChange={handleChange} className="input-dark" />
          </div>
          {trip === 'round' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="returnDate" className="label-xs">
                Coming back
              </label>
              <input
                id="returnDate"
                name="returnDate"
                type="date"
                min={formData.date || today}
                value={formData.returnDate}
                onChange={handleChange}
                className="input-dark"
              />
            </div>
          )}
          <div className={`flex flex-col gap-1.5 ${trip === 'round' ? 'col-span-2' : ''}`}>
            <label htmlFor="passengers" className="label-xs">
              Passengers
            </label>
            <select id="passengers" name="passengers" value={formData.passengers} onChange={handleChange} className="input-dark">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'passenger' : 'passengers'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="glass-btn w-full">
          <span className="icon-disc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
          </span>
          Search buses
        </button>
      </form>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Popular routes</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {POPULAR_ROUTES.map((route) => (
            <button
              key={`${route.from}-${route.to}`}
              type="button"
              onClick={() => goToRoute(route.from, route.to)}
              className="flex flex-col gap-1.5 glass-lite p-3.5 text-left transition hover:border-[#f5a524]"
            >
              <span className="text-sm font-bold">
                {route.from} → {route.to}
              </span>
              <span className="text-xs text-[#9ba7aa]">See today&apos;s buses</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Why book here</h2>

        <div className="flex items-start gap-3.5 glass-lite p-3.5">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#2dd4bf]/[0.14] text-[#2dd4bf]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
              <path d="M12 3 4 6v6c0 4.4 3.3 8.3 8 9 4.7-.7 8-4.6 8-9V6z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold">A ticket that can&apos;t be faked</span>
            <span className="text-[12.5px] leading-relaxed text-[#9ba7aa]">
              The conductor scans your QR and checks it live against our database. A screenshot won&apos;t pass.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3.5 glass-lite p-3.5">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#f5a524]/[0.14] text-[#f5a524]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold">Seats held for 10 minutes</span>
            <span className="text-[12.5px] leading-relaxed text-[#9ba7aa]">
              Your seat is locked while you pay, then released automatically if you change your mind.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3.5 glass-lite p-3.5">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#f2661d]/[0.16] text-[#f2661d]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">
              <rect x="2.5" y="6" width="19" height="13" rx="3" />
              <path d="M2.5 10.5h19" />
              <path d="M16.5 15.5h2" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold">bKash, Nagad, no account</span>
            <span className="text-[12.5px] leading-relaxed text-[#9ba7aa]">
              Pay the way you already pay. You never have to create a BusHub account to book.
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 flex items-center gap-3.5 rounded-[20px] border border-[#1e4b4f] bg-gradient-to-br from-[#0e3f43]/90 to-[#141a1c]/90 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#2dd4bf]/[0.16] text-[#2dd4bf]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
            <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
        </span>
        <div className="flex grow flex-col gap-1">
          <span className="text-sm font-bold">Book on WhatsApp</span>
          <span className="text-[12.5px] leading-snug text-[#a9bbbc]">
            Say &ldquo;hi&rdquo; to our bot and it finds your bus in seconds.
          </span>
        </div>
      </section>
    </div>
  )
}
