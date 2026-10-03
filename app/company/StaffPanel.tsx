'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
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
  counter: { label: 'Counter', badge: 'bg-[#6d4aff]/[0.18] text-[#b9a6ff]', hint: 'Sells seats at the counter and adds trips' },
  scanner: { label: 'Scanner', badge: 'bg-[#2dd4bf]/[0.15] text-[#5eead4]', hint: 'Bus staff (supervisor, conductor): scans tickets and adds trip costs' },
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
        <div className="flex flex-col gap-3 rounded-2xl border border-[#34d399]/40 bg-[#34d399]/[0.08] p-4 lg:col-span-2">
          <span className="text-[13.5px] font-bold text-[#6ee7b7]">Login ready for {shown.name}</span>
          <div className="rounded-xl bg-black/30 p-3 font-mono text-[12.5px] leading-relaxed text-[#e7e2da]">
            Email: {shown.email}
            <br />
            Password: {shown.password}
          </div>
          <p className="text-[11.5px] text-[#9ba7aa]">Pass these on now. The password is not shown again (you can make a new one any time).</p>
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
                form.role === role ? 'border-[#f5a524] bg-[#f5a524]/[0.08]' : 'border-white/[0.08] bg-black/20'
              }`}
            >
              <span className="text-[13.5px] font-bold">{ROLE_INFO[role].label}</span>
              <span className="text-[11px] leading-snug text-[#8e9a9d]">{ROLE_INFO[role].hint}</span>
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
        <div className="border-b border-[#1a2123] px-4 py-3">
          <span className="label-xs">Staff logins</span>
        </div>
        {staff === null && <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">Loading...</div>}
        {staff?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#8e9a9d]">No staff logins yet. Add one for each counter and each scanner phone.</div>
        )}
        {staff?.map((row) => (
          <div key={row._id} className="flex flex-col gap-2.5 border-b border-[#1a2123] px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <div className="flex min-w-0 grow flex-col">
                <span className={`truncate text-[14px] font-semibold ${row.status === 'disabled' ? 'text-[#6e7b7e] line-through' : ''}`}>{row.name}</span>
                <span className="truncate text-[11.5px] text-[#8e9a9d]">{row.email}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${ROLE_INFO[row.role].badge}`}>{ROLE_INFO[row.role].label}</span>
              {row.status === 'disabled' && <span className="shrink-0 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-[#9ba7aa]">Off</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const json = await patch(row, { resetPassword: true })
                  if (json?.password) setShown({ name: row.name, email: row.email, password: json.password, role: ROLE_INFO[row.role].label })
                }}
                className="h-8 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11.5px] font-bold text-[#f5a524]"
              >
                New password
              </button>
              <button
                type="button"
                onClick={() => patch(row, { status: row.status === 'active' ? 'disabled' : 'active' })}
                className="h-8 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11.5px] font-bold text-[#c4cdcf]"
              >
                {row.status === 'active' ? 'Switch off' : 'Switch on'}
              </button>
              <button type="button" onClick={() => remove(row)} className="h-8 rounded-full bg-[#f87171]/[0.1] px-3 text-[11.5px] font-bold text-[#fca5a5]">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
