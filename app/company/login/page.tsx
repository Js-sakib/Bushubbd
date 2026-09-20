'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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
      toast.success('Welcome back!')
      router.push('/company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">🚌 Company Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          New operator? <a href="/company/register" className="text-blue-600 hover:underline">Register here</a>
        </p>
      </div>
    </div>
  )
}
