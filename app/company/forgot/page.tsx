'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
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
      setSent(true)
    } catch {
      toast.error('No internet connection. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="card-2 flex flex-col gap-5 p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="display text-xl font-bold">Forgot password</h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#8e9a9d]">
              {sent ? 'Your request is with the BusHub team.' : 'We will send you a new password on WhatsApp.'}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#1e4b4f] bg-[#0e3f43]/40 p-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2dd4bf]/[0.16] text-[#2dd4bf]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M5 12.5 10 17l9-10" />
                </svg>
              </span>
              <p className="text-[13px] leading-relaxed text-[#c4cdcf]">
                If <strong className="break-all text-white">{email.trim()}</strong> has an operator account, our team will
                send a new password to the WhatsApp number on that account, usually within a few hours.
              </p>
            </div>
            <p className="text-center text-[12px] leading-relaxed text-[#8e9a9d]">
              Urgent, or changed your number? Email{' '}
              <a href="mailto:info@bushubbd.com" className="font-semibold text-[#2dd4bf]">
                info@bushubbd.com
              </a>
            </p>
            <button type="button" onClick={() => router.push(companyPath('/company/login'))} className="glass-btn glass-btn-plain w-full">
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="label-xs">
                Your account email
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
            <button type="submit" disabled={sending} className="glass-btn w-full">
              {sending ? 'Sending...' : 'Request a new password'}
            </button>
            <button
              type="button"
              onClick={() => router.push(companyPath('/company/login'))}
              className="text-center text-[12.5px] font-semibold text-[#8e9a9d] hover:text-[#f5a524]"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
