'use client'

/** A search field for the panel lists, with a clear button. */
export default function SearchBox({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-faint)]">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input-dark !h-11 w-full !pl-10 !pr-10 !text-[13.5px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-ink)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}
