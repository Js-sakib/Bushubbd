'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'

export default function CompanyLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/company/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        return
      }
      toast.success('Welcome back')
      router.push(companyPath('/company'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="card-2 flex flex-col gap-5 p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="display text-xl font-bold">Operator login</h1>
            <p className="mt-1 text-[12.5px] text-[#8e9a9d]">Manage your buses and bookings</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="label-xs">
              Email
            </label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="label-xs">
              Password
            </label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-dark" />
          </div>
          <button type="submit" disabled={loading} className="glass-btn w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[12.5px] text-[#8e9a9d]">
          New operator?{' '}
          <button type="button" onClick={() => router.push(companyPath('/company/register'))} className="font-semibold text-[#f5a524] hover:underline">
            Register here
          </button>
        </p>
      </div>
    </div>
  )
}
