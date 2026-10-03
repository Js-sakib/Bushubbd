'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import QrCamera from './QrCamera'
import ScanResultCard, { ScanResponse } from './ScanResultCard'
import ScanHistory, { type ScanStats } from './ScanHistory'
import StaffCosts from './StaffCosts'

const TABS = ['scan', 'history', 'costs'] as const

/** The scanner (bus staff) login's page: board passengers, see its own counts, and add trip costs. */
export default function ScannerView() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('scan')

  const [cameraOn, setCameraOn] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scan, setScan] = useState<ScanResponse | null>(null)

  const [stats, setStats] = useState<ScanStats | null>(null)

  const loadStats = useCallback(() => {
    fetch('/api/scan')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const checkTicket = useCallback(
    async (text: string) => {
      setCameraOn(false)
      setVerifying(true)
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.result) {
          toast.error(data?.error || 'Could not check the ticket. Check your internet and try again.')
          return
        }
        setScan(data)
        setManualCode('')
        // A buzz the supervisor can feel without looking: one for yes, three for no.
        navigator.vibrate?.(data.result === 'valid' ? 120 : [90, 60, 90, 60, 90])
        loadStats()
      } catch {
        toast.error('No internet connection. Try again in a moment.')
      } finally {
        setVerifying(false)
      }
    },
    [loadStats]
  )

  const scanNext = () => {
    setScan(null)
    setCameraOn(true)
  }

  return (
    <div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-gradient-to-br from-[#0dabab] to-[#0a7479] p-4">
          <span className="text-[11.5px] font-bold text-[#d9fbfa]">Boarded today</span>
          <span className="display text-3xl font-bold leading-none text-white">{stats?.today.passengers ?? '–'}</span>
          <span className="text-[11.5px] text-[#d9fbfa]">
            {stats ? `${stats.today.tickets} ticket${stats.today.tickets === 1 ? '' : 's'} scanned` : 'passengers'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-gradient-to-br from-[#2f5bc4] to-[#24479b] p-4">
          <span className="text-[11.5px] font-bold text-[#dbe6ff]">Last 7 days</span>
          <span className="display text-3xl font-bold leading-none text-white">{stats?.week.passengers ?? '–'}</span>
          <span className="text-[11.5px] text-[#dbe6ff]">
            {stats ? `${stats.week.tickets} ticket${stats.week.tickets === 1 ? '' : 's'} scanned` : 'passengers'}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? 'chip-active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="mt-5 flex flex-col gap-4">
          {verifying && (
            <div className="flex aspect-[4/3] w-full items-center justify-center glass-lite text-sm text-[#44526b]">
              Checking ticket...
            </div>
          )}

          {!verifying && scan && (
            <>
              <ScanResultCard scan={scan} />
              <button type="button" onClick={scanNext} className="glass-btn w-full">
                <span className="icon-disc">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
                  </svg>
                </span>
                Scan next ticket
              </button>
            </>
          )}

          {!verifying && !scan && cameraOn && (
            <>
              <QrCamera onDetected={checkTicket} />
              <button type="button" onClick={() => setCameraOn(false)} className="glass-btn glass-btn-plain h-12 w-full text-sm">
                Close camera
              </button>
            </>
          )}

          {!verifying && !scan && !cameraOn && (
            <button
              type="button"
              onClick={() => setCameraOn(true)}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed border-[#cc8b65]/50 bg-[#feb249]/[0.05] transition hover:bg-[#feb249]/[0.09]"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f2661d] to-[#feb249] text-[#170b02] shadow-[0_12px_30px_rgba(242,102,29,0.35)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                  <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
                  <path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 13v3" />
                </svg>
              </span>
              <span className="display text-[20px] font-bold">Tap to scan a ticket</span>
              <span className="text-[12.5px] text-[#44526b]">Point the camera at the passenger&apos;s QR code</span>
            </button>
          )}

          {!verifying && !scan && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (manualCode.trim()) checkTicket(manualCode)
              }}
              className="flex flex-col gap-2.5 glass-lite p-4"
            >
              <label htmlFor="manual-code" className="label-xs">
                Or type the booking code
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="BH-20260925-K7M2P"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="input-dark min-w-0 grow font-mono"
                />
                <button type="submit" disabled={!manualCode.trim()} className="glass-btn h-12 shrink-0 px-5 text-sm">
                  Check
                </button>
              </div>
            </form>
          )}

          <p className="rounded-2xl border border-[#c3d1e0] bg-white/70 px-4 py-3 text-[12px] leading-relaxed text-[#34445f]">
            Seats sold at the counter and new trips are handled by your company&apos;s counter and manager logins. For help,
            write to{' '}
            <a href="mailto:info@bushubbd.com" className="font-bold text-[#0f8f80]">
              info@bushubbd.com
            </a>
            .
          </p>
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-5">
          <ScanHistory stats={stats} />
        </div>
      )}

      {tab === 'costs' && <StaffCosts />}
    </div>
  )
}
