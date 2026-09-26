'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import PasswordInput from '../../PasswordInput'
import { companyPath } from '@/lib/panelNav'
import { LogoMark } from '../../BrandLogo'

export default function CompanyRegister() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', ownerName: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Registration failed')
        return
      }
      toast.success(data.message || 'Registered. Await approval.')
      router.push(companyPath('/company/login'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-sm">
      <div className="card-2 flex flex-col gap-5 p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-12 w-12" />
          <div>
            <h1 className="display text-xl font-bold">Register your bus company</h1>
            <p className="mt-1 text-[12.5px] leading-snug text-[#8e9a9d]">
              An admin reviews and approves your account before you can log in.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
          <input required placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="input-dark" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" />
          <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark" />
          <PasswordInput
            placeholder="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
          />
          <button type="submit" disabled={loading} className="glass-btn w-full">
            {loading ? 'Submitting...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-[12.5px] text-[#8e9a9d]">
          Already registered?{' '}
          <button type="button" onClick={() => router.push(companyPath('/company/login'))} className="font-semibold text-[#f5a524] hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
