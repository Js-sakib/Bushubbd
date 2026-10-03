'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { companyPath } from '@/lib/panelNav'
import { LogoMark } from '../BrandLogo'
import CounterView from './CounterView'
import ManagerView from './ManagerView'
import ScannerView from './ScannerView'
import type { Me } from './types'

const ROLES = { manager: 'Management', counter: 'Counter', scanner: 'Bus staff · scanner' } as const
const ROLE_STYLE = {
  manager: 'bg-[#f5a524]/[0.15] text-[#fbbf24]',
  counter: 'bg-[#6d4aff]/[0.18] text-[#c4b5fd]',
  scanner: 'bg-[#2dd4bf]/[0.15] text-[#5eead4]',
} as const

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
    <div className={`mx-auto pb-10 ${me.role === 'manager' ? 'max-w-6xl' : me.role === 'counter' ? 'max-w-5xl' : 'max-w-xl'}`}>
      <div className="flex items-center gap-3 border-b border-[#1b2325] pb-4">
        <LogoMark className="h-9 w-9 shrink-0" />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display truncate text-[19px] font-bold leading-tight">{me.companyName}</h1>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ROLE_STYLE[me.role]}`}>{ROLES[me.role]}</span>
            {me.role !== 'manager' && <span className="truncate text-[12.5px] font-semibold text-[#c4cdcf]">{me.name}</span>}
          </span>
        </div>
        <button type="button" onClick={logout} className="chip">
          Logout
        </button>
      </div>
      {me.role === 'manager' && <ManagerView companyName={me.companyName} />}
      {me.role === 'counter' && <CounterView />}
      {me.role === 'scanner' && <ScannerView />}
    </div>
  )
}
