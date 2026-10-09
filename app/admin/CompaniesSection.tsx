'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { whatsappNumber } from '@/lib/phone'
import PasswordInput from '../PasswordInput'
import type { CompanyPrefill, CompanyRow } from './types'
import SearchBox from '../SearchBox'
import { matches } from '@/lib/search'
import { downloadSheet, sheetDate } from '@/lib/sheet'

const STATUS_WORD = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

/** Every bus company as an Excel file: contact details, status and commission. */
function downloadCompanies(companies: CompanyRow[]) {
  const today = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10)
  downloadSheet(
    `BusHub-bus-companies-${sheetDate(today)}`,
    [
      {
        name: 'Bus companies',
        title: 'BusHub · bus companies',
        notes: [`${companies.length} companies`, 'Red = not approved yet, or suspended.'],
        columns: [
          { header: 'Company' },
          { header: 'Owner / contact' },
          { header: 'Phone' },
          { header: 'Email' },
          { header: 'Status', highlight: { equals: ['Pending', 'Suspended'] } },
          { header: 'BusHub commission', kind: 'percent' },
          { header: 'Joined', kind: 'datetime' },
          { header: 'Asked for new password', kind: 'datetime' },
        ],
        rows: [...companies]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => [c.name, c.ownerName, c.phone, c.email, STATUS_WORD(c.status), c.commissionRate ?? 10, c.createdAt, c.passwordResetRequestedAt || '']),
      },
    ],
    {
      summary: {
        title: 'BusHub · bus companies',
        items: [
          { label: 'Bus companies', value: companies.length },
          { label: 'Approved', value: companies.filter((c) => c.status === 'approved').length },
          { label: 'Waiting for approval', value: companies.filter((c) => c.status === 'pending').length },
          { label: 'Suspended', value: companies.filter((c) => c.status === 'suspended').length },
        ],
      },
    }
  )
}

/** A password to pass on once: after a reset, or for a company the admin just added (isNew). */
type NewLogin = { name: string; email: string; phone: string; password: string; isNew?: boolean }

const EMPTY_COMPANY = { name: '', ownerName: '', phone: '', email: '', commissionRate: '10' }

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-[#3fd0c9]/[0.13] text-[#0a8a84]',
  suspended: 'bg-[#f87171]/[0.13] text-[#c13b3b]',
  pending: 'bg-[#feb249]/[0.14] text-[#8a6d00]',
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="icon-btn shrink-0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}

function NewLoginCard({ login, onClose }: { login: NewLogin; onClose: () => void }) {
  const wa = whatsappNumber(login.phone)
  const message = [
    login.isNew
      ? `Welcome to BusHub! Your ticket scanner account for ${login.name} is ready.`
      : `Your BusHub ticket scanner password has been reset.`,
    ``,
    `Login: https://bushubbd.com/company/login`,
    `Email: ${login.email}`,
    `${login.isNew ? 'Password' : 'New password'}: ${login.password}`,
  ].join('\n')

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error('Copy failed. Press and hold the text to copy it.')
    }
  }

  return (
    <div className="glass flex flex-col gap-3.5 border-[#cc8b65]/60 p-5" style={{ borderColor: 'rgba(254,178,73,0.55)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="display text-[16px] font-bold">
            {login.isNew ? `${login.name} is added` : `New password for ${login.name}`}
          </span>
          <span className="text-[12px] leading-snug text-[#222222]">Shown only once. Send it to them now; it cannot be seen again later.</span>
        </div>
        <CloseButton onClick={onClose} label="Close" />
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-[#111111]/10 bg-white/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#4a4a4a]">Email</span>
          <span className="break-all text-right text-[13.5px] font-semibold">{login.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#4a4a4a]">Password</span>
          <span className="select-all font-mono text-[17px] font-bold tracking-wide text-[#0b7f8c]">{login.password}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => copy(login.password, 'Password')} className="glass-btn glass-btn-plain h-12 whitespace-nowrap px-3 text-[13px]">
          Copy password
        </button>
        {wa ? (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="glass-btn glass-btn-teal h-12 whitespace-nowrap px-3 text-[13px]">
            Send on WhatsApp
          </a>
        ) : (
          <button type="button" onClick={() => copy(message, 'Message')} className="glass-btn glass-btn-teal h-12 whitespace-nowrap px-3 text-[13px]">
            Copy message
          </button>
        )}
      </div>
    </div>
  )
}

export default function CompaniesSection({
  companies,
  onChanged,
  prefill,
  onPrefillUsed,
}: {
  companies: CompanyRow[]
  onChanged: () => void
  /** A lead that said yes: opens the Add form with their details filled in. */
  prefill?: CompanyPrefill | null
  onPrefillUsed?: () => void
}) {
  const [newLogin, setNewLogin] = useState<NewLogin | null>(null)
  const [resetTarget, setResetTarget] = useState<CompanyRow | null>(null)
  const [typedPassword, setTypedPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!prefill) return
    setCompanyForm({ ...EMPTY_COMPANY, ...prefill })
    setAdding(true)
    setNewLogin(null)
    setResetTarget(null)
    onPrefillUsed?.()
  }, [prefill, onPrefillUsed])

  const [search, setSearch] = useState('')
  // Operators waiting on a new password go to the top of the list.
  const rows = [...companies].filter((c) => matches(search, c.name, c.ownerName, c.email, c.phone, c.status)).sort(
    (a, b) => Number(Boolean(b.passwordResetRequestedAt)) - Number(Boolean(a.passwordResetRequestedAt))
  )
  const waiting = companies.filter((c) => c.passwordResetRequestedAt)

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success('Company updated')
      onChanged()
    } else {
      toast.error('Failed to update company')
    }
  }

  /** BusHub's commission for the company: set when it was added, changed here only if needed. */
  const editCommission = async (c: CompanyRow) => {
    const next = prompt(
      `BusHub commission for ${c.name}, in % (0 to 50).\n\nAll their buses use it. Trips still to come use the new rate from their next sale; tickets already sold keep their split.`,
      String(c.commissionRate ?? 10)
    )
    if (next === null) return
    const res = await fetch(`/api/companies/${c._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionRate: next }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Could not change the commission')
      return
    }
    toast.success(`${c.name}: ${data.commissionRate}% commission`)
    onChanged()
  }

  const startReset = (company: CompanyRow) => {
    setNewLogin(null)
    setTypedPassword('')
    setResetTarget(company)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** With no password given, the server generates a strong one. */
  const submitReset = async (password?: string) => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch(`/api/companies/${resetTarget._id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(password ? { password } : {}),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.password) {
        toast.error(data?.error || 'Could not reset the password')
        return
      }
      setResetTarget(null)
      setTypedPassword('')
      setNewLogin(data)
      onChanged()
    } finally {
      setResetting(false)
    }
  }

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.password) {
        toast.error(data?.error || 'Could not add the company')
        return
      }
      setAdding(false)
      setCompanyForm(EMPTY_COMPANY)
      setResetTarget(null)
      setNewLogin({ ...data.company, password: data.password, isNew: true })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {newLogin && <NewLoginCard login={newLogin} onClose={() => setNewLogin(null)} />}

      <section className="glass flex flex-col">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className="flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#feb249] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="display text-[15.5px] font-bold">Add a bus company</span>
              <span className="text-[11.5px] text-[#555555]">Each company once. They get a login to scan tickets.</span>
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 text-[#4a4a4a] transition ${adding ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {adding && (
          <form onSubmit={addCompany} className="grid gap-3 border-t border-[#111111]/10 px-5 pb-5 pt-4 sm:grid-cols-2">
            <input required placeholder="Company name, e.g. Green Line" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="input-dark" aria-label="Company name" />
            <input required placeholder="Contact person" value={companyForm.ownerName} onChange={(e) => setCompanyForm({ ...companyForm, ownerName: e.target.value })} className="input-dark" aria-label="Contact person" />
            <input required type="tel" placeholder="Phone (01…)" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} className="input-dark" aria-label="Phone" />
            <input required type="email" placeholder="Email for their login" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="input-dark" aria-label="Login email" />
            <label className="relative flex sm:col-span-2">
              <input
                required
                type="number"
                min={0}
                max={50}
                step="0.5"
                inputMode="decimal"
                placeholder="Commission"
                value={companyForm.commissionRate}
                onChange={(e) => setCompanyForm({ ...companyForm, commissionRate: e.target.value })}
                className="input-dark w-full pr-36"
                aria-label="BusHub commission percent"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#4a4a4a]">% BusHub commission</span>
            </label>
            <p className="-mt-1 text-[11.5px] text-[#555555] sm:col-span-2">Set once for this company; all its buses use it. You can change it later here if needed.</p>
            <button type="submit" disabled={saving} className="glass-btn h-12 sm:col-span-2">
              {saving ? 'Adding…' : 'Add company and create login'}
            </button>
          </form>
        )}
      </section>

      {resetTarget && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitReset(typedPassword)
          }}
          className="glass flex flex-col gap-3.5 p-5"
          style={{ borderColor: 'rgba(254,178,73,0.55)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="display text-[16px] font-bold">New password for {resetTarget.name}</span>
              <span className="text-[12px] leading-snug text-[#222222]">Their old password stops working as soon as you save.</span>
            </div>
            <CloseButton onClick={() => setResetTarget(null)} label="Cancel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-company-password" className="label-xs">
              Type a new password
            </label>
            <PasswordInput
              id="new-company-password"
              value={typedPassword}
              onChange={setTypedPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="submit" disabled={resetting || typedPassword.trim().length < 8} className="glass-btn h-12 whitespace-nowrap px-3 text-[13px]">
              Save password
            </button>
            <button type="button" disabled={resetting} onClick={() => submitReset()} className="glass-btn glass-btn-plain h-12 whitespace-nowrap px-3 text-[13px]">
              Generate one
            </button>
          </div>
          {typedPassword && typedPassword.trim().length < 8 && (
            <span className="text-[11.5px] text-[#0b7f8c]">{8 - typedPassword.trim().length} more characters needed</span>
          )}
        </form>
      )}

      {!newLogin && !resetTarget && waiting.length > 0 && (
        <div className="glass flex flex-col gap-2.5 p-4" style={{ borderColor: 'rgba(254,178,73,0.5)' }}>
          <span className="text-[13px] font-bold text-[#0b7f8c]">
            {waiting.length === 1 ? '1 operator is' : `${waiting.length} operators are`} waiting for a new password
          </span>
          {waiting.map((c) => (
            <div key={c._id} className="flex items-center gap-3 rounded-2xl bg-white/60 px-3.5 py-3">
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[13.5px] font-semibold">{c.name}</span>
                <span className="truncate text-[11.5px] text-[#4a4a4a]">
                  {c.phone} · {c.email}
                </span>
              </div>
              <button type="button" onClick={() => startReset(c)} className="shrink-0 rounded-full bg-[#feb249] px-3.5 py-2 text-[12.5px] font-bold text-[#2b1a02]">
                Reset
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="glass flex flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 className="display text-[15.5px] font-bold">Bus companies</h2>
          <div className="flex items-center gap-2.5">
            <span className="text-[11.5px] text-[#555555]">{companies.length} registered</span>
            {companies.length > 0 && (
              <button type="button" onClick={() => downloadCompanies(companies)} className="glass-btn glass-btn-plain h-9 px-3.5 text-[12.5px]">
                ⬇ Excel
              </button>
            )}
          </div>
        </div>
        {companies.length > 3 && (
          <div className="px-5 pb-3">
            <SearchBox value={search} onChange={setSearch} placeholder="Search company, person, email, phone" />
          </div>
        )}
        {companies.length === 0 && <p className="px-5 pb-8 pt-4 text-center text-sm text-[#4a4a4a]">No companies registered yet.</p>}
        <ul className="flex flex-col">
          {rows.map((c) => (
            <li key={c._id} className={`flex flex-col gap-3 border-t border-[#111111]/10 px-5 py-3.5 ${c.passwordResetRequestedAt ? 'bg-[#feb249]/[0.05]' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#111111]/10 bg-[#111111]/[0.05] text-[13px] font-bold text-[#0b7f8c]">
                  {(c.name || '?').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold">{c.name}</span>
                  <span className="truncate text-[12px] text-[#3f3f3f]">{c.ownerName}</span>
                  <span className="truncate text-[11.5px] text-[#5e5e5e]">
                    {c.email} · {c.phone}
                  </span>
                  <span className="text-[11.5px] font-bold text-[#0b7f8c]">{c.commissionRate ?? 10}% BusHub commission</span>
                  {c.passwordResetRequestedAt && <span className="text-[11.5px] font-bold text-[#0b7f8c]">Asked for a new password</span>}
                </div>
                <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold capitalize ${STATUS_STYLE[c.status] || STATUS_STYLE.pending}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status !== 'approved' && (
                  <button type="button" onClick={() => setStatus(c._id, 'approved')} className="h-9 rounded-full bg-[#3fd0c9]/[0.14] px-3.5 text-[12px] font-bold text-[#0a8a84] transition hover:bg-[#3fd0c9]/[0.22]">
                    Approve
                  </button>
                )}
                {c.status !== 'suspended' && (
                  <button type="button" onClick={() => setStatus(c._id, 'suspended')} className="h-9 rounded-full bg-[#f87171]/[0.1] px-3.5 text-[12px] font-bold text-[#c13b3b] transition hover:bg-[#f87171]/[0.18]">
                    Suspend
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startReset(c)}
                  className={
                    c.passwordResetRequestedAt
                      ? 'h-9 rounded-full bg-[#feb249] px-3.5 text-[12px] font-bold text-[#2b1a02]'
                      : 'h-9 rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3.5 text-[12px] font-bold text-[#0b7f8c] transition hover:bg-[#111111]/[0.05]'
                  }
                >
                  Reset password
                </button>
                <button
                  type="button"
                  onClick={() => editCommission(c)}
                  className="h-9 rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3.5 text-[12px] font-bold text-[#222222] transition hover:bg-[#111111]/[0.05]"
                >
                  Edit commission
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
