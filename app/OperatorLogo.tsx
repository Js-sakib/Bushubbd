'use client'

import { useState } from 'react'

/**
 * The operator's own logo where one is set, otherwise the generic bus mark.
 * A logo URL that fails to load falls back too, so a dead link never leaves a broken image
 * on a search result or a ticket.
 */
export default function OperatorLogo({
  logoUrl,
  name,
  className = '',
  variant = 'dark',
}: {
  logoUrl?: string
  name?: string
  /** Sizing and radius come from the caller, e.g. "h-[42px] w-[42px] rounded-[13px]". */
  className?: string
  variant?: 'dark' | 'light'
}) {
  const [failed, setFailed] = useState(false)
  const showLogo = Boolean(logoUrl) && !failed

  const tone =
    variant === 'light'
      ? 'text-[#0e3f43] ring-1 ring-[#e3e8e9]'
      : 'bg-[#f5a524]/[0.13] text-[#f5a524]'

  return (
    <span
      style={variant === 'light' ? { backgroundColor: '#ffffff' } : undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden ${tone} ${className}`}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name ? `${name} logo` : ''}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-1/2 w-1/2">
          <rect x="3" y="4" width="18" height="12.5" rx="3" />
          <path d="M3 11h18" />
          <circle cx="7.5" cy="19" r="1.6" />
          <circle cx="16.5" cy="19" r="1.6" />
        </svg>
      )}
    </span>
  )
}
