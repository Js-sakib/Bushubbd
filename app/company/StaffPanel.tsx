'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { matches } from '@/lib/search'
import SearchBox from '../SearchBox'
import { SITE_URL } from '@/lib/site'

interface StaffRow {
  _id: string
  name: string
  email: string
  role: 'counter' | 'scanner'
  status: 'active' | 'disabled'
  createdAt: string
}

const ROLE_INFO = {
  counter: { label: 'Counter', badge: 'bg-[#5eb1bf]/[0.18] text-[#2d7886]', hint: 'Sells seats at the counter and adds trips' },
  scanner: { label: 'Scanner', badge: 'bg-[#2dd4bf]/[0.15] text-[#0f8f80]', hint: 'Bus staff (supervisor, conductor): scans tickets and adds trip costs' },
}

const EMPTY = { name: '', email: '', role: 'counter' as 'counter' | 'scanner', password: '' }

/** The details to pass on to a staff member, ready to paste into WhatsApp. */
function loginMessage(name: string, email: string, password: string, role: string) {
  return `BusHub ${role} login for ${name}\nOpen: ${SITE_URL}/company/login\nEmail: ${email}\nPassword: ${password}`
}

/**
 * The manager's staff logins: add a counter or scanner login, switch one off (it stops working at
 * once), give it a new password, or remove it. Passwords are shown once, to pass on.
 */
export default function StaffPanel() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<{ name: string; email: string; password: string; role: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/company/staff', { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    setStaff(json?.staff || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/company/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || 'Could not add the login')
        return
      }
      setShown({ name: json.staff.name, email: json.staff.email, password: json.password, role: ROLE_INFO[form.role].label })
      setForm({ ...EMPTY, role: form.role })
      load()
    } finally {
      setBusy(false)
    }
  }

  const patch = async (row: StaffRow, body: Record<string, unknown>) => {
    const res = await fetch(`/api/company/staff/${row._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(json?.error || 'Could not change the login')
      return null
    }
    load()
    return json
  }

  const remove = async (row: StaffRow) => {
    if (!confirm(`Remove ${row.name}'s login for good? Seats it sold stay sold.`)) return
    const res = await fetch(`/api/company/staff/${row._id}`, { method: 'DELETE' })
    if (!res.ok) toast.error('Could not remove the login')
    else toast.success('Login removed')
    load()
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      {shown && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#3fd0c9]/40 bg-[#3fd0c9]/[0.08] p-4 lg:col-span-2">
          <span className="text-[13.5px] font-bold text-[#0a8a84]">Login ready for {shown.name}</span>
          <div className="rounded-xl bg-white/60 p-3 font-mono text-[12.5px] leading-relaxed text-[#1b1b1b]">
            Email: {shown.email}
            <br />
            Password: {shown.password}
          </div>
          <p className="text-[11.5px] text-[#3f3f3f]">Pass these on now. The password is not shown again (you can make a new one any time).</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(loginMessage(shown.name, shown.email, shown.password, shown.role))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn glass-btn-teal h-10 px-4 text-[13px]"
            >
              Send on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(loginMessage(shown.name, shown.email, shown.password, shown.role))
                toast.success('Copied')
              }}
              className="glass-btn glass-btn-plain h-10 px-4 text-[13px]"
            >
              Copy
            </button>
            <button type="button" onClick={() => setShown(null)} className="chip">
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={add} className="glass-lite grid gap-3 p-4 sm:grid-cols-2">
        <span className="display text-[15px] font-bold sm:col-span-2">Add a staff login</span>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          {(['counter', 'scanner'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setForm({ ...form, role })}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left ${
                form.role === role ? 'border-[#cc8b65] bg-[#feb249]/[0.08]' : 'border-[#111111]/10 bg-white/60'
              }`}
            >
              <span className="text-[13.5px] font-bold">{ROLE_INFO[role].label}</span>
              <span className="text-[11px] leading-snug text-[#4a4a4a]">{ROLE_INFO[role].hint}</span>
            </button>
          ))}
        </div>
        <input required placeholder={form.role === 'counter' ? 'Name, e.g. Dampara counter' : 'Name, e.g. Supervisor Karim'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" aria-label="Staff name" />
        <input required type="email" placeholder="Email for this login" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" aria-label="Staff email" />
        <input placeholder="Password (leave empty to make one)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-dark sm:col-span-2" aria-label="Staff password" autoComplete="new-password" />
        <button type="submit" disabled={busy} className="glass-btn h-12 sm:col-span-2">
          {busy ? 'Adding…' : `Add ${ROLE_INFO[form.role].label.toLowerCase()} login`}
        </button>
      </form>

      <div className="card-2 overflow-hidden">
        <div className="border-b border-[#c9d6e4] px-4 py-3">
          <span className="label-xs">Staff logins</span>
        </div>
        {(staff?.length || 0) > 4 && (
          <div className="border-b border-[#c9d6e4] px-3 py-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, counter or scanner" />
          </div>
        )}
        {staff === null && <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">Loading...</div>}
        {staff?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#4a4a4a]">No staff logins yet. Add one for each counter and each scanner phone.</div>
        )}
        {staff?.filter((row) => matches(search, row.name, row.email, ROLE_INFO[row.role].label, row.status === 'disabled' ? 'off' : 'active')).map((row) => (
          <div key={row._id} className="flex flex-col gap-2.5 border-b border-[#c9d6e4] px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <div className="flex min-w-0 grow flex-col">
                <span className={`truncate text-[14px] font-semibold ${row.status === 'disabled' ? 'text-[#5e5e5e] line-through' : ''}`}>{row.name}</span>
                <span className="truncate text-[11.5px] text-[#4a4a4a]">{row.email}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${ROLE_INFO[row.role].badge}`}>{ROLE_INFO[row.role].label}</span>
              {row.status === 'disabled' && <span className="shrink-0 rounded-full bg-[#111111]/[0.05] px-2.5 py-1 text-[11px] font-bold text-[#3f3f3f]">Off</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const json = await patch(row, { resetPassword: true })
                  if (json?.password) setShown({ name: row.name, email: row.email, password: json.password, role: ROLE_INFO[row.role].label })
                }}
                className="h-8 rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3 text-[11.5px] font-bold text-[#0b7f8c]"
              >
                New password
              </button>
              <button
                type="button"
                onClick={() => patch(row, { status: row.status === 'active' ? 'disabled' : 'active' })}
                className="h-8 rounded-full border border-[#111111]/10 bg-[#111111]/[0.05] px-3 text-[11.5px] font-bold text-[#222222]"
              >
                {row.status === 'active' ? 'Switch off' : 'Switch on'}
              </button>
              <button type="button" onClick={() => remove(row)} className="h-8 rounded-full bg-[#f87171]/[0.1] px-3 text-[11.5px] font-bold text-[#c13b3b]">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
