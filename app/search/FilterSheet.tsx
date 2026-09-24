'use client'

import { useEffect, useState } from 'react'
import {
  BusFilters,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  SortKey,
  TIME_SLOTS,
  TimeSlotKey,
  countActiveFilters,
} from '@/lib/busFilters'

function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  // Stop the page behind the sheet from scrolling while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-[26px] border border-white/10 bg-[#12181a]/90 backdrop-blur-xl sm:max-w-md sm:rounded-[26px]"
      >
        <div className="flex items-center gap-3 border-b border-[#1c2426] px-5 py-4">
          <span className="display grow text-[16px] font-bold">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="grow overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-[#1c2426] px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function SortSheet({
  value,
  onChange,
  onClose,
}: {
  value: SortKey
  onChange: (key: SortKey) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Sort buses by" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onChange(option.key)
              onClose()
            }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              value === option.key ? 'border-[#f5a524] bg-[#f5a524]/[0.09]' : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <span className="flex grow flex-col gap-0.5">
              <span className="text-sm font-bold">{option.label}</span>
              <span className="text-[11.5px] text-[#8e9a9d]">{option.hint}</span>
            </span>
            {value === option.key && (
              <svg viewBox="0 0 24 24" fill="none" stroke="#f5a524" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Toggle({ active, label, hint, onClick }: { active: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left transition ${
        active ? 'border-[#f5a524] bg-[#f5a524]/[0.09] text-[#f5a524]' : 'border-white/10 bg-white/[0.04] text-[#c4cdcf]'
      }`}
    >
      <span className="text-[13px] font-bold">{label}</span>
      {hint && <span className="text-[11px] text-[#8e9a9d]">{hint}</span>}
    </button>
  )
}

export function FiltersSheet({
  filters,
  operators,
  types,
  priceRange,
  onApply,
  onClose,
}: {
  filters: BusFilters
  operators: string[]
  types: string[]
  priceRange: { min: number; max: number }
  onApply: (next: BusFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<BusFilters>(filters)

  const toggle = <K extends 'types' | 'slots' | 'operators'>(key: K, value: string) => {
    setDraft((prev) => {
      const list = prev[key] as string[]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...prev, [key]: next } as BusFilters
    })
  }

  const active = countActiveFilters(draft)
  const sliderMax = Math.max(priceRange.max, priceRange.min + 1)

  return (
    <Sheet
      title="Filters"
      onClose={onClose}
      footer={
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="glass-btn glass-btn-plain h-12 grow text-sm"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className="glass-btn h-12 grow text-sm"
          >
            Show buses{active > 0 ? ` (${active})` : ''}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {types.length > 1 && (
          <div className="flex flex-col gap-2.5">
            <span className="label-xs">Bus type</span>
            <div className="grid grid-cols-2 gap-2">
              {types.map((type) => (
                <Toggle key={type} active={draft.types.includes(type)} label={type} onClick={() => toggle('types', type)} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <span className="label-xs">Departure time</span>
          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((slot) => (
              <Toggle
                key={slot.key}
                active={draft.slots.includes(slot.key)}
                label={slot.label}
                hint={slot.range}
                onClick={() => toggle('slots', slot.key as TimeSlotKey)}
              />
            ))}
          </div>
        </div>

        {operators.length > 1 && (
          <div className="flex flex-col gap-2.5">
            <span className="label-xs">Bus operator</span>
            <div className="flex flex-col gap-2">
              {operators.map((operator) => (
                <Toggle
                  key={operator}
                  active={draft.operators.includes(operator)}
                  label={operator}
                  onClick={() => toggle('operators', operator)}
                />
              ))}
            </div>
          </div>
        )}

        {priceRange.max > priceRange.min && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="label-xs">Maximum fare</span>
              <span className="text-[13px] font-bold text-[#f5a524]">
                ৳{draft.maxPrice ?? priceRange.max}
              </span>
            </div>
            <input
              type="range"
              min={priceRange.min}
              max={sliderMax}
              step={10}
              value={draft.maxPrice ?? sliderMax}
              onChange={(e) => {
                const value = Number(e.target.value)
                setDraft((prev) => ({ ...prev, maxPrice: value >= sliderMax ? null : value }))
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#242d30] accent-[#f2661d]"
            />
            <div className="flex justify-between text-[11px] text-[#78868a]">
              <span>৳{priceRange.min}</span>
              <span>৳{sliderMax}</span>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
