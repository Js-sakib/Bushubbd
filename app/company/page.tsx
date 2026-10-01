'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { companyPath } from '@/lib/panelNav'
import { LogoMark } from '../BrandLogo'
import CounterView from './CounterView'
import ManagerView from './ManagerView'
import ScannerView from './ScannerView'
import type { Me } from './types'

const TITLES = { manager: 'Management', counter: 'Counter', scanner: 'Ticket scanner' } as const

/**
 * One address for everyone at a bus company. The company login opens Management; counter and
 * scanner logins (made by the manager) open their own pages.
 */
export default function OperatorPanel() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!data.company) {
          router.push(companyPath('/company/login'))
          return
        }
        setMe(data.company)
      })
      .catch(() => router.push(companyPath('/company/login')))
  }, [router])

  const logout = async () => {
    await fetch('/api/company/login', { method: 'DELETE' })
    router.push(companyPath('/company/login'))
  }

  if (!me) return <div className="py-16 text-center text-sm text-[#8e9a9d]">Checking access...</div>

  return (
    <div className={`mx-auto pb-10 ${me.role === 'manager' ? 'max-w-3xl' : 'max-w-xl'}`}>
      <div className="flex items-center gap-3 border-b border-[#1b2325] pb-4">
        <LogoMark className="h-9 w-9 shrink-0" />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display text-[19px] font-bold leading-tight">{TITLES[me.role]}</h1>
          <span className="truncate text-[11.5px] text-[#78868a]">
            {me.companyName}
            {me.role === 'manager' ? '' : ` · ${me.name}`}
          </span>
        </div>
        <button type="button" onClick={logout} className="chip">
          Logout
        </button>
      </div>
      {me.role === 'manager' && <ManagerView />}
      {me.role === 'counter' && <CounterView />}
      {me.role === 'scanner' && <ScannerView />}
    </div>
  )
}
