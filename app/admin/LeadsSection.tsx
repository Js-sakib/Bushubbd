'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LEAD_SOURCES, LEAD_STATUSES, leadStatusLabel } from '@/lib/leads'
import { telHref, whatsappNumber } from '@/lib/phone'
import { formatTripDate } from '@/lib/dates'
import { dhakaDate } from '@/lib/scan'
import type { CompanyRow, LeadRow } from './types'

const EMPTY_FORM = { companyName: '', contactName: '', phone: '', altPhone: '', area: '', source: 'Counter visit', followUpDate: '', note: '' }

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-white/[0.07] text-[#c4cdcf]',
  called: 'bg-[#60a5fa]/[0.14] text-[#93c5fd]',
  interested: 'bg-[#f5a524]/[0.15] text-[#fbbf24]',
  trial: 'bg-[#a78bfa]/[0.16] text-[#c4b5fd]',
  joined: 'bg-[#34d399]/[0.14] text-[#6ee7b7]',
  not_interested: 'bg-[#f87171]/[0.12] text-[#fca5a5]',
}

/** Leads that are finished (joined or said no) don't need a follow-up reminder. */
const CLOSED = ['joined', 'not_interested']

export function isDue(lead: LeadRow, today = dhakaDate()): boolean {
  return Boolean(lead.followUpDate) && lead.followUpDate <= today && !CLOSED.includes(lead.status)
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, data, error: (data?.error as string) || '' }
}

function when(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

function PhoneButtons({ phone }: { phone: string }) {
  const wa = whatsappNumber(phone)
  return (
    <div className="flex items-center gap-2">
      <a href={telHref(phone)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#34d399]/[0.14] px-3.5 text-[12.5px] font-bold text-[#6ee7b7]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />
        </svg>
        {phone}
      </a>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-full bg-[#12a594]/[0.16] px-3 text-[12px] font-bold text-[#5eead4]">
          WhatsApp
        </a>
      )}
    </div>
  )
}

function LeadCard({
  lead,
  company,
  today,
  onChanged,
  onCreateLogin,
}: {
  lead: LeadRow
  company?: CompanyRow
  today: string
  onChanged: () => void
  onCreateLogin: (lead: LeadRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const due = isDue(lead, today)
  const lastNote = lead.notes[lead.notes.length - 1]

  const update = async (body: Record<string, unknown>, done?: string) => {
    setSaving(true)
    const { ok, error } = await send(`/api/leads/${lead._id}`, 'PATCH', body)
    setSaving(false)
    if (!ok) {
      toast.error(error || 'Could not save')
      return false
    }
    if (done) toast.success(done)
    onChanged()
    return true
  }

  const remove = async () => {
    if (!confirm(`Delete ${lead.companyName} from your leads?`)) return
    const { ok, error } = await send(`/api/leads/${lead._id}`, 'DELETE')
    if (!ok) {
      toast.error(error || 'Could not delete')
      return
    }
    toast.success('Deleted')
    onChanged()
  }

  return (
    <li className={`flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4 ${due ? 'bg-[#f2661d]/[0.06]' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{lead.companyName}</span>
          {(lead.contactName || lead.area) && (
            <span className="truncate text-[12px] text-[#9ba7aa]">{[lead.contactName, lead.area].filter(Boolean).join(' · ')}</span>
          )}
          {lead.followUpDate && !CLOSED.includes(lead.status) && (
            <span className={`text-[11.5px] font-bold ${due ? 'text-[#ff8a4c]' : 'text-[#78868a]'}`}>
              {lead.followUpDate < today ? 'Follow-up overdue: ' : lead.followUpDate === today ? 'Follow up today: ' : 'Next follow-up: '}
              {formatTripDate(lead.followUpDate)}
            </span>
          )}
          {company && <span className="text-[11.5px] font-bold text-[#6ee7b7]">Has a BusHub login ({company.status})</span>}
        </div>
        <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold ${STATUS_STYLE[lead.status] || STATUS_STYLE.new}`}>
          {leadStatusLabel(lead.status)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lead.phone && <PhoneButtons phone={lead.phone} />}
        {lead.altPhone && <PhoneButtons phone={lead.altPhone} />}
      </div>

      {lastNote && !open && <p className="line-clamp-2 text-[12.5px] leading-snug text-[#b7c1c3]">“{lastNote.text}”</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lead.status}
          disabled={saving}
          onChange={(e) => update({ status: e.target.value }, `Marked ${leadStatusLabel(e.target.value)}`)}
          aria-label={`Status of ${lead.companyName}`}
          className="input-dark h-9 !w-auto min-w-[150px] py-0 text-[12.5px]"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 rounded-full border border-white/10 bg-white/[0.05] px-3.5 text-[12px] font-bold text-[#f5a524] transition hover:bg-white/[0.09]"
        >
          {open ? 'Close' : `Notes${lead.notes.length ? ` (${lead.notes.length})` : ''}`}
        </button>
        {['interested', 'trial', 'joined'].includes(lead.status) && !company && (
          <button type="button" onClick={() => onCreateLogin(lead)} className="h-9 rounded-full bg-[#f5a524] px-3.5 text-[12px] font-bold text-[#2b1a02]">
            Create their login
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!note.trim()) return
              if (await update({ note }, 'Note saved')) setNote('')
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What did they say? e.g. Manager Karim wants 5% for 3 months"
              aria-label="New note"
              className="input-dark h-auto py-2.5 text-[13.5px]"
            />
            <button type="submit" disabled={saving || !note.trim()} className="glass-btn h-10 text-[13px]">
              Save note
            </button>
          </form>

          <label className="flex items-center justify-between gap-3 text-[12.5px] text-[#c4cdcf]">
            Next follow-up
            <span className="flex items-center gap-2">
              <input
                type="date"
                value={lead.followUpDate}
                onChange={(e) => update({ followUpDate: e.target.value }, e.target.value ? 'Follow-up set' : 'Follow-up cleared')}
                className="input-dark h-9 !w-auto py-0 text-[12.5px]"
                aria-label="Next follow-up date"
              />
            </span>
          </label>

          {lead.notes.length > 0 && (
            <ol className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
              {[...lead.notes].reverse().map((n, i) => (
                <li key={`${n.at}-${i}`} className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#78868a]">{when(n.at)}</span>
                  <span className="whitespace-pre-wrap text-[13px] leading-snug text-[#dfe5e6]">{n.text}</span>
                </li>
              ))}
            </ol>
          )}

          <button type="button" onClick={remove} className="self-start text-[12px] font-bold text-[#fca5a5]">
            Delete this lead
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * The bus companies the BusHub team is trying to sign up: who to call, what they said, and
 * when to call again. A company that says yes gets its scanner login from here.
 */
export default function LeadsSection({
  leads,
  companies,
  onChanged,
  onCreateLogin,
}: {
  leads: LeadRow[]
  companies: CompanyRow[]
  onChanged: () => void
  onCreateLogin: (lead: LeadRow) => void
}) {
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const today = dhakaDate()

  const companyByName = useMemo(() => {
    const map = new Map<string, CompanyRow>()
    for (const c of companies) map.set(c.name.trim().toLowerCase().replace(/\s+/g, ' '), c)
    return map
  }, [companies])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, due: 0 }
    for (const l of leads) {
      c[l.status] = (c[l.status] || 0) + 1
      if (isDue(l, today)) c.due++
    }
    return c
  }, [leads, today])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads
      .filter((l) => (filter === 'all' ? true : filter === 'due' ? isDue(l, today) : l.status === filter))
      .filter((l) => !q || [l.companyName, l.contactName, l.area, l.phone, l.altPhone].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        // Due follow-ups first, then open leads by next follow-up, finished leads last.
        const rank = (l: LeadRow) => (isDue(l, today) ? 0 : CLOSED.includes(l.status) ? 2 : 1)
        if (rank(a) !== rank(b)) return rank(a) - rank(b)
        const fa = a.followUpDate || '9999'
        const fb = b.followUpDate || '9999'
        if (fa !== fb) return fa < fb ? -1 : 1
        return a.updatedAt < b.updatedAt ? 1 : -1
      })
  }, [leads, filter, search, today])

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { ok, error } = await send('/api/leads', 'POST', form)
    setSaving(false)
    if (!ok) {
      toast.error(error || 'Could not save the lead')
      return
    }
    toast.success(`${form.companyName.trim()} added`)
    setForm({ ...EMPTY_FORM, source: form.source })
    setAdding(false)
    onChanged()
  }

  const loadStarter = async () => {
    setSaving(true)
    const { ok, data, error } = await send('/api/leads', 'POST', { starter: true })
    setSaving(false)
    if (!ok) {
      toast.error(error || 'Could not load the list')
      return
    }
    toast.success(data?.added ? `${data.added} companies added` : 'They are all on your list already')
    onChanged()
  }

  const chips: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'due', label: 'Follow up now' },
    ...LEAD_STATUSES.map((s) => ({ key: s.key, label: s.label })),
  ]

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: 'To call', value: counts.new || 0 },
          { label: 'Interested', value: (counts.interested || 0) + (counts.trial || 0) },
          { label: 'Joined', value: counts.joined || 0 },
        ].map((t) => (
          <div key={t.label} className="glass flex flex-col gap-1 px-4 py-3.5">
            <span className="label-xs">{t.label}</span>
            <span className="display text-[24px] font-bold tabular-nums">{t.value}</span>
          </div>
        ))}
      </section>

      <section className="glass flex flex-col">
        <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="flex items-center justify-between gap-3 px-5 py-4 text-left">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2661d] to-[#f5a524] text-[#1a0d03] shadow-[0_6px_18px_rgba(242,102,29,0.35)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="display text-[15.5px] font-bold">Add a bus company lead</span>
              <span className="text-[11.5px] text-[#78868a]">A company you met at a counter or found online</span>
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 text-[#8e9a9d] transition ${adding ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {adding && (
          <form onSubmit={addLead} className="grid gap-3 border-t border-white/[0.06] px-5 pb-5 pt-4 sm:grid-cols-2">
            <input required placeholder="Bus company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input-dark" aria-label="Bus company name" />
            <input placeholder="Contact person (owner, manager)" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="input-dark" aria-label="Contact person" />
            <input required type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark" aria-label="Phone" />
            <input type="tel" placeholder="Second phone (optional)" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} className="input-dark" aria-label="Second phone" />
            <input placeholder="Routes or counter, e.g. Dhaka–Rajshahi, Gabtoli" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input-dark" aria-label="Routes or counter" />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="input-dark" aria-label="Where you found them">
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label-xs">Next follow-up (optional)</span>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} className="input-dark" aria-label="Next follow-up" />
            </label>
            <textarea rows={2} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input-dark h-auto py-2.5 sm:col-span-2" aria-label="Note" />
            <button type="submit" disabled={saving} className="glass-btn h-12 sm:col-span-2">
              Save lead
            </button>
          </form>
        )}
      </section>

      {leads.length === 0 ? (
        <section className="glass flex flex-col items-start gap-3 p-5">
          <span className="display text-[16px] font-bold">No leads yet</span>
          <p className="text-[13px] leading-relaxed text-[#c4cdcf]">
            Start with 9 well-known bus companies. Their public numbers come from their own websites and Facebook pages. Numbers change, so check each one when you call.
          </p>
          <button type="button" onClick={loadStarter} disabled={saving} className="glass-btn h-11 px-5 text-[13.5px]">
            Load the 9 companies
          </button>
        </section>
      ) : (
        <section className="glass flex flex-col overflow-hidden">
          <div className="flex flex-col gap-3 px-5 pb-3 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-[15.5px] font-bold">Leads</h2>
              <span className="text-[11.5px] text-[#78868a]">{shown.length} shown</span>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, person, route, phone" aria-label="Search leads" className="input-dark h-11 text-[13.5px]" />
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={`chip shrink-0 whitespace-nowrap ${filter === c.key ? 'chip-active' : ''}`}
                >
                  {c.label}
                  <span className="tabular-nums opacity-70">{counts[c.key] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <p className="px-5 pb-8 pt-2 text-center text-sm text-[#8e9a9d]">Nothing here.</p>}
          <ul className="flex flex-col">
            {shown.map((l) => (
              <LeadCard
                key={l._id}
                lead={l}
                company={companyByName.get(l.companyName.trim().toLowerCase().replace(/\s+/g, ' '))}
                today={today}
                onChanged={onChanged}
                onCreateLogin={onCreateLogin}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
