'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { companyPath } from '@/lib/panelNav'

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
      toast.success(data.message || 'Registered! Await approval.')
      router.push(companyPath('/company/login'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">🚌 Register Your Bus Company</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">An admin will review and approve your account before you can log in.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required placeholder="Company Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <input required placeholder="Owner Name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <input required placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg">
            {loading ? 'Submitting...' : 'Register'}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          Already registered?{' '}
          <button onClick={() => router.push(companyPath('/company/login'))} className="text-blue-600 hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
