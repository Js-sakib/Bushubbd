'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'
import { LogoMark } from '../../BrandLogo'
import PasswordInput from '../../PasswordInput'

type Step = 'email' | 'code' | 'manual' | 'done'

/** Seconds before "Send a new code" works again. */
const RESEND_WAIT = 60

function Tick() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2dd4bf]/[0.16] text-[#0f8f80]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M5 12.5 10 17l9-10" />
      </svg>
    </span>
  )
}

/**
 * "Forgot password" for bus company owners: a 6-digit code goes to the account's email and
 * WhatsApp, and the code plus a new password sets it. When codes can't be sent yet, the request
 * goes to the BusHub team instead, as before.
 */
export default function ForgotPassword() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const backToLogin = () => router.push(companyPath('/company/login'))

  const askForCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/company/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Could not send your request, please try again')
        return
      }
      if (data?.mode === 'code') {
        if (step === 'code') toast.success('A new code is on its way')
        setStep('code')
        setWait(RESEND_WAIT)
      } else {
        setStep('manual')
      }
    } catch {
      toast.error('No internet connection. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('The two passwords are not the same')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/company/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Could not change your password, please try again')
        return
      }
      setStep('done')
    } catch {
      toast.error('No internet connection. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  const subtitle = {
    email: 'We will send a 6-digit code to your email and WhatsApp.',
    code: 'Type the code we sent and choose a new password.',
    manual: 'Your request is with the BusHub team.',
    done: 'Your password is changed.',
  }[step]

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="card-2 flex flex-col gap-5 p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-12 w-12" />
          <div>
            <h1 className="display text-xl font-bold">Forgot password</h1>
            <p className="mt-0.5 text-[12.5px] font-semibold text-[#3f3f3f]">পাসওয়ার্ড ভুলে গেছেন?</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#4a4a4a]">{subtitle}</p>
          </div>
        </div>

        {step === 'email' && (
          <form onSubmit={askForCode} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="label-xs">
                Your account email · অ্যাকাউন্টের ইমেইল
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark"
              />
            </div>
            <button type="submit" disabled={busy} className="glass-btn w-full">
              {busy ? 'Sending...' : 'Send me a code'}
            </button>
            <p className="text-center text-[12px] leading-relaxed text-[#4a4a4a]">
              Counter or scanner staff? Ask your company manager to reset your password.
            </p>
            <button type="button" onClick={backToLogin} className="text-center text-[12.5px] font-semibold text-[#4a4a4a] hover:text-[#0b7f8c]">
              Back to sign in
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={resetPassword} className="flex flex-col gap-3.5">
            <p className="rounded-2xl border border-[#c3d1e0] bg-white/70 p-3.5 text-[12.5px] leading-relaxed text-[#222222]">
              If <strong className="break-all">{email.trim()}</strong> has a BusHub operator account, we sent a 6-digit code to its email and
              WhatsApp. It works for 10 minutes.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code" className="label-xs">
                6-digit code · কোড
              </label>
              <input
                id="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="input-dark text-center text-lg font-bold tracking-[0.4em]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="label-xs">
                New password · নতুন পাসওয়ার্ড
              </label>
              <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="label-xs">
                Type it again
              </label>
              <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} />
            </div>
            <button type="submit" disabled={busy} className="glass-btn w-full">
              {busy ? 'Saving...' : 'Change password'}
            </button>
            <button
              type="button"
              disabled={busy || wait > 0}
              onClick={() => askForCode()}
              className="text-center text-[12.5px] font-semibold text-[#0b7f8c] disabled:text-[#8a8a8a]"
            >
              {wait > 0 ? `Send a new code in ${wait}s` : 'Did not get it? Send a new code'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="text-center text-[12.5px] font-semibold text-[#4a4a4a] hover:text-[#0b7f8c]">
              Use a different email
            </button>
          </form>
        )}

        {step === 'manual' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#c3d1e0] bg-white/70 p-5 text-center">
              <Tick />
              <p className="text-[13px] leading-relaxed text-[#222222]">
                If <strong className="break-all">{email.trim()}</strong> has an operator account, our team will send a new password to the
                WhatsApp number on that account, usually within a few hours.
              </p>
            </div>
            <p className="text-center text-[12px] leading-relaxed text-[#4a4a4a]">
              Urgent, or changed your number? Email{' '}
              <a href="mailto:info@bushubbd.com" className="font-semibold text-[#0f8f80]">
                info@bushubbd.com
              </a>
            </p>
            <button type="button" onClick={backToLogin} className="glass-btn glass-btn-plain w-full">
              Back to sign in
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#c3d1e0] bg-white/70 p-5 text-center">
              <Tick />
              <p className="text-[13px] leading-relaxed text-[#222222]">
                Your new password is saved. Sign in with it now. · নতুন পাসওয়ার্ড দিয়ে লগইন করুন।
              </p>
            </div>
            <button type="button" onClick={backToLogin} className="glass-btn w-full">
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
