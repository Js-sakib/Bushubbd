'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import PasswordInput from '../PasswordInput'
import type { CompanyRow } from './types'

type NewLogin = { name: string; email: string; phone: string; password: string }

/** Bangladeshi numbers are usually typed as 01XXXXXXXXX; wa.me needs 8801XXXXXXXXX. */
function whatsappNumber(phone: string): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (/^8801\d{9}$/.test(digits)) return digits
  if (/^01\d{9}$/.test(digits)) return `88${digits}`
  return null
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-[#34d399]/[0.13] text-[#6ee7b7]',
  suspended: 'bg-[#f87171]/[0.13] text-[#fca5a5]',
  pending: 'bg-[#f5a524]/[0.14] text-[#fbbf24]',
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
    `Your BusHub ticket scanner password has been reset.`,
    ``,
    `Login: https://bushubbd.com/company/login`,
    `Email: ${login.email}`,
    `New password: ${login.password}`,
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
    <div className="glass flex flex-col gap-3.5 border-[#f5a524]/60 p-5" style={{ borderColor: 'rgba(245,165,36,0.55)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="display text-[16px] font-bold">New password for {login.name}</span>
          <span className="text-[12px] leading-snug text-[#c4cdcf]">Shown only once. Send it to them now; it cannot be seen again later.</span>
        </div>
        <CloseButton onClick={onClose} label="Close" />
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#8e9a9d]">Email</span>
          <span className="break-all text-right text-[13.5px] font-semibold">{login.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#8e9a9d]">Password</span>
          <span className="select-all font-mono text-[17px] font-bold tracking-wide text-[#f5a524]">{login.password}</span>
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

export default function CompaniesSection({ companies, onChanged }: { companies: CompanyRow[]; onChanged: () => void }) {
  const [newLogin, setNewLogin] = useState<NewLogin | null>(null)
  const [resetTarget, setResetTarget] = useState<CompanyRow | null>(null)
  const [typedPassword, setTypedPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Operators waiting on a new password go to the top of the list.
  const rows = [...companies].sort(
    (a, b) => Number(Boolean(b.passwordResetRequestedAt)) - Number(Boolean(a.passwordResetRequestedAt))
  )
  const waiting = rows.filter((c) => c.passwordResetRequestedAt)

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

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {newLogin && <NewLoginCard login={newLogin} onClose={() => setNewLogin(null)} />}

      {resetTarget && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitReset(typedPassword)
          }}
          className="glass flex flex-col gap-3.5 p-5"
          style={{ borderColor: 'rgba(245,165,36,0.55)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="display text-[16px] font-bold">New password for {resetTarget.name}</span>
              <span className="text-[12px] leading-snug text-[#c4cdcf]">Their old password stops working as soon as you save.</span>
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
            <span className="text-[11.5px] text-[#f5a524]">{8 - typedPassword.trim().length} more characters needed</span>
          )}
        </form>
      )}

      {!newLogin && !resetTarget && waiting.length > 0 && (
        <div className="glass flex flex-col gap-2.5 p-4" style={{ borderColor: 'rgba(245,165,36,0.5)' }}>
          <span className="text-[13px] font-bold text-[#f5a524]">
            {waiting.length === 1 ? '1 operator is' : `${waiting.length} operators are`} waiting for a new password
          </span>
          {waiting.map((c) => (
            <div key={c._id} className="flex items-center gap-3 rounded-2xl bg-black/25 px-3.5 py-3">
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[13.5px] font-semibold">{c.name}</span>
                <span className="truncate text-[11.5px] text-[#8e9a9d]">
                  {c.phone} · {c.email}
                </span>
              </div>
              <button type="button" onClick={() => startReset(c)} className="shrink-0 rounded-full bg-[#f5a524] px-3.5 py-2 text-[12.5px] font-bold text-[#2b1a02]">
                Reset
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="glass flex flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
          <h2 className="display text-[15.5px] font-bold">Bus companies</h2>
          <span className="text-[11.5px] text-[#78868a]">{companies.length} registered</span>
        </div>
        {companies.length === 0 && <p className="px-5 pb-8 pt-4 text-center text-sm text-[#8e9a9d]">No companies registered yet.</p>}
        <ul className="flex flex-col">
          {rows.map((c) => (
            <li key={c._id} className={`flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3.5 ${c.passwordResetRequestedAt ? 'bg-[#f5a524]/[0.05]' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[13px] font-bold text-[#f5a524]">
                  {(c.name || '?').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold">{c.name}</span>
                  <span className="truncate text-[12px] text-[#9ba7aa]">{c.ownerName}</span>
                  <span className="truncate text-[11.5px] text-[#6e7b7e]">
                    {c.email} · {c.phone}
                  </span>
                  {c.passwordResetRequestedAt && <span className="text-[11.5px] font-bold text-[#f5a524]">Asked for a new password</span>}
                </div>
                <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold capitalize ${STATUS_STYLE[c.status] || STATUS_STYLE.pending}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status !== 'approved' && (
                  <button type="button" onClick={() => setStatus(c._id, 'approved')} className="h-9 rounded-full bg-[#34d399]/[0.14] px-3.5 text-[12px] font-bold text-[#6ee7b7] transition hover:bg-[#34d399]/[0.22]">
                    Approve
                  </button>
                )}
                {c.status !== 'suspended' && (
                  <button type="button" onClick={() => setStatus(c._id, 'suspended')} className="h-9 rounded-full bg-[#f87171]/[0.1] px-3.5 text-[12px] font-bold text-[#fca5a5] transition hover:bg-[#f87171]/[0.18]">
                    Suspend
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startReset(c)}
                  className={
                    c.passwordResetRequestedAt
                      ? 'h-9 rounded-full bg-[#f5a524] px-3.5 text-[12px] font-bold text-[#2b1a02]'
                      : 'h-9 rounded-full border border-white/10 bg-white/[0.05] px-3.5 text-[12px] font-bold text-[#f5a524] transition hover:bg-white/[0.09]'
                  }
                >
                  Reset password
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
