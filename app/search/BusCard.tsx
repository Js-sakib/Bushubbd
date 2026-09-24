'use client'

import { seatsLeft as calcSeatsLeft } from '@/lib/seats'
import OperatorLogo from '../OperatorLogo'

export interface SearchBus {
  _id: string
  companyName: string
  busName: string
  busType: string
  logoUrl?: string
  from: string
  to: string
  date: string
  departureTime: string
  arrivalTime: string
  price: number
  totalSeats: number
  bookedSeats: string[]
  blockedSeats?: string[]
}

export default function BusCard({
  bus,
  cheapest,
  selected,
  actionLabel,
  onSelect,
}: {
  bus: SearchBus
  /** Marks the lowest fare in the current result list. */
  cheapest?: boolean
  selected?: boolean
  actionLabel: string
  onSelect: (bus: SearchBus) => void
}) {
  const seatsLeft = calcSeatsLeft(bus)
  const soldOut = seatsLeft <= 0
  const scarce = seatsLeft > 0 && seatsLeft <= 5

  return (
    <div
      className={`flex flex-col gap-3.5 glass-lite p-4 transition ${
        selected
          ? '!border-[#f5a524] !shadow-[0_0_0_1px_rgba(245,165,36,0.35),0_14px_40px_rgba(0,0,0,0.32)]'
          : soldOut
            ? 'opacity-60'
            : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <OperatorLogo logoUrl={bus.logoUrl} name={bus.companyName} className="h-[42px] w-[42px] rounded-[13px]" />
        <div className="flex grow flex-col gap-1">
          <span className="text-[15px] font-bold">{bus.busName}</span>
          <span className="text-xs text-[#8e9a9d]">
            {bus.companyName} · {bus.busType} · {bus.totalSeats} seats
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="display text-[19px] font-bold text-[#f5a524]">৳{bus.price}</span>
          <span className="text-[11px] text-[#8e9a9d]">per seat</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">{bus.departureTime}</span>
          <span className="text-[11px] text-[#8e9a9d]">{bus.from}</span>
        </div>
        <div className="flex grow items-center gap-1.5">
          <span className="h-px grow bg-[#2c3639]" />
          <svg viewBox="0 0 24 24" fill="none" stroke="#f2661d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <rect x="3" y="4" width="18" height="12.5" rx="3" />
            <path d="M3 11h18" />
          </svg>
          <span className="h-px grow bg-[#2c3639]" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[15px] font-bold">{bus.arrivalTime || '—'}</span>
          <span className="text-[11px] text-[#8e9a9d]">{bus.to}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {soldOut ? (
          <span className="inline-flex h-[26px] items-center rounded-full bg-white/[0.07] px-2.5 text-[11.5px] font-bold text-[#c4cdcf]">
            Sold out
          </span>
        ) : (
          <span
            className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-[11.5px] font-bold ${
              scarce ? 'bg-[#f5a524]/[0.13] text-[#f5a524]' : 'bg-[#34d399]/[0.13] text-[#34d399]'
            }`}
          >
            {seatsLeft} seats left
          </span>
        )}

        {cheapest && !soldOut && (
          <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-[#2dd4bf]/[0.14] px-2.5 text-[11.5px] font-bold text-[#2dd4bf]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
            Cheapest
          </span>
        )}

        {!soldOut && (
          <button
            type="button"
            onClick={() => onSelect(bus)}
            className={`ml-auto h-[42px] px-5 text-sm ${selected ? 'glass-btn glass-btn-teal' : 'glass-btn'}`}
          >
            <span className={`h-6 w-6 ${selected ? 'icon-disc icon-disc-teal' : 'icon-disc'}`}>
              {selected ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="m5 12.5 4.5 4.5L19 7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M5 12h13" />
                  <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
                </svg>
              )}
            </span>
            {selected ? 'Selected' : actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
