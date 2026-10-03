'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogoMark } from '../../BrandLogo'
import PasswordInput from '../../PasswordInput'
import { formatTripDate } from '@/lib/dates'
import { PAY_METHODS, PAY_METHOD_LABELS, statusOf, type InvoiceSummaryView, type PayMethod } from '@/lib/payoutText'
import { taka } from '@/lib/tripMoney'

interface Line {
  bookingId: string
  code: string
  passengerName: string
  date: string
  departureTime: string
  from: string
  to: string
  busName: string
  seats: string[]
  ticketPrice: number
  commissionRate: number
  commission: number
  payout: number
}

interface Deduction {
  _id: string
  code: string
  date: string
  departureTime: string
  from: string
  to: string
  busName: string
  seats: string[]
  ticketPrice: number
  amount: number
  paidIn: string
}

interface Invoice extends InvoiceSummaryView {
  lines: Line[]
  deductions: Deduction[]
  contentHash: string
  history: { at: string; by: string; event: string }[]
  check: { contentOk: boolean; signatureOk: boolean | null }
}

function dhakaDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** The invoice's tickets trip by trip, each trip with its own subtotal. */
function groupByTrip(lines: Line[]) {
  const trips: { key: string; first: Line; lines: Line[]; seats: number; price: number; commission: number; payout: number }[] = []
  for (const l of lines) {
    const key = `${l.date}|${l.departureTime}|${l.busName}|${l.from}|${l.to}`
    let trip = trips.find((t) => t.key === key)
    if (!trip) {
      trip = { key, first: l, lines: [], seats: 0, price: 0, commission: 0, payout: 0 }
      trips.push(trip)
    }
    trip.lines.push(l)
    trip.seats += l.seats.length
    trip.price += l.ticketPrice
    trip.commission += l.commission
    trip.payout += l.payout
  }
  return trips
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-bold text-[#100c0d]' : 'text-[#4a4a4a]'}>{label}</span>
      <span className={`shrink-0 whitespace-nowrap ${strong ? 'text-[18px] font-extrabold text-[#100c0d]' : 'font-semibold text-[#100c0d]'}`}>{value}</span>
    </div>
  )
}

/** Method, reference and note: used to record a payment and to correct one. */
function PaymentFields({
  method,
  setMethod,
  reference,
  setReference,
  note,
  setNote,
}: {
  method: PayMethod
  setMethod: (m: PayMethod) => void
  reference: string
  setReference: (v: string) => void
  note: string
  setNote: (v: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {PAY_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-xl border px-2 py-2 text-[12.5px] font-bold ${method === m ? 'border-[#cc8b65] bg-[#feb249]/[0.12] text-[#0b7f8c]' : 'border-[#111111]/10 text-[#2b2b2b]'}`}
          >
            {PAY_METHOD_LABELS[m]}
          </button>
        ))}
      </div>
      {method === 'cash' ? (
        <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 60))} placeholder="Who received the cash? (optional)" className="input-dark" aria-label="Who received the cash" />
      ) : (
        <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 60))} placeholder="Reference / TrxID, e.g. 9JK4M2PQ7X" className="input-dark font-mono" aria-label="Payment reference" />
      )}
      <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Note (optional), e.g. sent to 017… merchant number" className="input-dark" aria-label="Payment note" />
    </>
  )
}

/**
 * Admin: record the payment, correct it later (a signed invoice then needs the company's
 * signature again), take back a payment recorded by mistake, or cancel an unpaid invoice.
 */
function AdminActions({ inv, onDone }: { inv: Invoice; onDone: () => void }) {
  const toPay = inv.status === 'unpaid' || inv.status === 'disputed'
  const canEdit = Boolean(inv.payment) && ['paid', 'disputed', 'confirmed'].includes(inv.status)
  const [editing, setEditing] = useState(false)
  const start = inv.payment && editing ? inv.payment : null
  const [method, setMethod] = useState<PayMethod>('bkash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (start) {
      setMethod(start.method)
      setReference(start.reference)
      setNote(start.note || '')
    }
  }, [start])
  const send = async (body: object, ok: string) => {
    setBusy(true)
    const res = await fetch(`/api/admin/payouts/${inv._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return toast.error(data?.error || 'No internet connection. Try again.')
    toast.success(ok)
    setEditing(false)
    onDone()
  }
  const ready = method === 'cash' || reference.trim().length >= 4
  const says = `${method === 'cash' ? 'in cash' : `by ${PAY_METHOD_LABELS[method]}, ref ${reference.trim()}`}`

  if (!toPay && !canEdit) return null
  return (
    <div className="no-print glass flex flex-col gap-3 p-4">
      {toPay && !editing ? (
        <>
          <span className="display text-[16px] font-bold">Pay {taka(inv.totals.payout)} to {inv.companyName}</span>
          {inv.approval ? (
            <span className="text-[12.5px] font-semibold text-[#2d7886]">
              ✓ Approved by the company ({inv.approval.by}, {dhakaDateTime(inv.approval.at)})
            </span>
          ) : inv.status === 'unpaid' ? (
            <span className="text-[12.5px] text-[#8a6d00]">The company has not approved this invoice yet.</span>
          ) : null}
          <p className="text-[12.5px] text-[#3f3f3f]">
            Send the money first, then write down how you sent it and the reference (bKash TrxID, bank reference). Cash needs no reference. The company then
            checks it and signs.
          </p>
          <PaymentFields method={method} setMethod={setMethod} reference={reference} setReference={setReference} note={note} setNote={setNote} />
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() =>
              confirm(
                `${inv.approval ? '' : 'The company has not approved this invoice yet.\n\n'}Record ${taka(inv.totals.payout)} paid to ${inv.companyName} ${says}?`
              ) && send({ action: 'paid', method, reference: reference.trim(), note }, 'Payment recorded')
            }
            className="glass-btn h-12"
          >
            {busy ? 'Saving…' : `I paid ${taka(inv.totals.payout)}`}
          </button>
          {(inv.status === 'unpaid' || (inv.status === 'disputed' && !inv.payment)) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm('Cancel this invoice? Its tickets go back to "owed" for the next invoice.') && send({ action: 'cancel' }, 'Invoice cancelled')}
              className="text-[12.5px] font-semibold text-[#d23c3c]"
            >
              Cancel this invoice
            </button>
          )}
          {inv.status === 'disputed' && canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-[#0b7f8c]">
              Correct the recorded payment instead
            </button>
          )}
        </>
      ) : editing ? (
        <>
          <span className="display text-[16px] font-bold">Correct the payment</span>
          {inv.status === 'confirmed' && (
            <p className="rounded-xl border border-[#cc8b65]/40 bg-[#feb249]/[0.08] px-3.5 py-2.5 text-[12.5px] text-[#8a6d00]">
              The company already signed this. After a change it has to check and sign again.
            </p>
          )}
          <PaymentFields method={method} setMethod={setMethod} reference={reference} setReference={setReference} note={note} setNote={setNote} />
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => confirm(`Change the payment to ${taka(inv.totals.payout)} ${says}?`) && send({ action: 'edit', method, reference: reference.trim(), note }, 'Payment corrected')}
            className="glass-btn h-12"
          >
            {busy ? 'Saving…' : 'Save the correction'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[12.5px] font-semibold text-[#3f3f3f]">
            Back
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold">Payment recorded</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="glass-btn glass-btn-plain h-10 px-4 text-[13px]">
              Edit payment details
            </button>
            {inv.status === 'paid' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm('Remove this payment? Use this only if the money was not actually sent. The invoice goes back to unpaid.') && send({ action: 'unpay' }, 'Payment removed')}
                className="h-10 rounded-full border border-[#f87171]/30 px-4 text-[13px] font-semibold text-[#c13b3b]"
              >
                Money was not sent: remove payment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Company manager: sign that the money arrived, or say what is wrong. */
function CompanyActions({ inv, onDone }: { inv: Invoice; onDone: () => void }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async (body: object, ok: string) => {
    setBusy(true)
    const res = await fetch(`/api/company/payouts/${inv._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return toast.error(data?.error || 'No internet connection. Try again.')
    toast.success(ok)
    setPassword('')
    onDone()
  }
  if (inv.status === 'unpaid' && inv.approval) {
    return (
      <p className="no-print rounded-2xl border border-[#86c6d1]/30 bg-[#86c6d1]/[0.08] px-4 py-3 text-[12.5px] text-[#d4eef2]">
        ✓ You approved this invoice ({inv.approval.by}, {dhakaDateTime(inv.approval.at)}). BusHub will now pay {taka(inv.totals.payout)}; then come back and tap Done.
      </p>
    )
  }
  if (inv.status === 'unpaid') {
    return (
      <div className="no-print glass flex flex-col gap-3 p-4">
        <span className="display text-[16px] font-bold">Review and approve</span>
        <p className="text-[12.5px] leading-relaxed text-[#3f3f3f]">
          Check the tickets below: {inv.totals.tickets} tickets, {inv.totals.seats} seats, original price {taka(inv.totals.ticketTotal)}, BusHub commission{' '}
          {taka(inv.totals.commission)}. If everything is right, approve it and BusHub pays you <b className="text-[#111111]">{taka(inv.totals.payout)}</b>.
        </p>
        {problem === null ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm(`Approve ${inv.number}: BusHub pays you ${taka(inv.totals.payout)}?`) && send({ action: 'approve' }, 'Approved. BusHub will pay you.')}
              className="glass-btn h-12"
            >
              {busy ? 'Saving…' : `Approve · ${taka(inv.totals.payout)}`}
            </button>
            <button type="button" onClick={() => setProblem('')} className="text-[12.5px] font-semibold text-[#d23c3c]">
              Something is wrong?
            </button>
          </>
        ) : (
          <>
            <textarea value={problem} onChange={(e) => setProblem(e.target.value.slice(0, 300))} rows={3} placeholder="What is wrong? e.g. Ticket BH-… is missing" className="input-dark h-auto py-3" aria-label="What is wrong" />
            <button type="button" disabled={busy || problem.trim().length < 5} onClick={() => send({ action: 'dispute', note: problem }, 'Sent to BusHub')} className="glass-btn h-12">
              Report the problem to BusHub
            </button>
            <button type="button" onClick={() => setProblem(null)} className="text-[12.5px] font-semibold text-[#3f3f3f]">
              Back
            </button>
          </>
        )}
      </div>
    )
  }
  if (inv.status !== 'paid' || !inv.payment) return null
  return (
    <div className="no-print glass flex flex-col gap-3 p-4">
      <span className="display text-[16px] font-bold">Money arrived? Tap Done</span>
      <p className="text-[12.5px] leading-relaxed text-[#3f3f3f]">
        {inv.payment.method === 'cash' ? (
          <>
            BusHub says it paid <b className="text-[#111111]">{taka(inv.payment.amount)}</b> in cash{inv.payment.reference ? ` to ${inv.payment.reference}` : ''}. Count the
            cash first. Sign only if you received all of it.
          </>
        ) : (
          <>
            BusHub says it sent <b className="text-[#111111]">{taka(inv.payment.amount)}</b> by {PAY_METHOD_LABELS[inv.payment.method]} (ref{' '}
            <span className="font-mono text-[#111111]">{inv.payment.reference}</span>). Check your {PAY_METHOD_LABELS[inv.payment.method]} or bank first. Sign only if the
            money has arrived.
          </>
        )}
      </p>
      {problem === null ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Your full name" className="input-dark" aria-label="Your full name" autoComplete="name" />
          <PasswordInput value={password} onChange={setPassword} placeholder="Company login password" autoComplete="current-password" />
          <label className="flex items-start gap-2.5 text-[12.5px] text-[#222222]">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#cc8b65]" />
            I checked the tickets on this invoice and received {taka(inv.payment.amount)}.
          </label>
          <button type="button" disabled={busy || !checked || name.trim().length < 3 || !password} onClick={() => send({ action: 'confirm', signedBy: name, password }, 'Signed. Thank you!')} className="glass-btn h-12">
            {busy ? 'Signing…' : 'Done: money received'}
          </button>
          <button type="button" onClick={() => setProblem('')} className="text-[12.5px] font-semibold text-[#d23c3c]">
            Money not received, or something is wrong?
          </button>
        </>
      ) : (
        <>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value.slice(0, 300))} rows={3} placeholder="What is wrong? e.g. Nothing arrived on our bKash yet" className="input-dark h-auto py-3" aria-label="What is wrong" />
          <button type="button" disabled={busy || problem.trim().length < 5} onClick={() => send({ action: 'dispute', note: problem }, 'Sent to BusHub')} className="glass-btn h-12">
            Report the problem to BusHub
          </button>
          <button type="button" onClick={() => setProblem(null)} className="text-[12.5px] font-semibold text-[#3f3f3f]">
            Back
          </button>
        </>
      )}
    </div>
  )
}

/**
 * A payout invoice: every BusHub ticket BusHub pays the company for, trip by trip, with the
 * ticket price, BusHub's commission and what the company gets; then the payment and the
 * company's signature, with a check that nothing changed since. Prints on white paper.
 */
function InvoiceView() {
  const { id } = useParams<{ id: string }>()
  const as = useSearchParams().get('as')
  const [inv, setInv] = useState<Invoice | null>(null)
  const [viewer, setViewer] = useState<'admin' | 'company' | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    fetch(`/api/payouts/${id}${as === 'admin' ? '?as=admin' : ''}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        if (!ok) return setError(d?.error || 'Could not open the invoice')
        setInv(d.invoice)
        setViewer(d.viewer)
      })
      .catch(() => setError('No internet connection'))
  }, [id, as])
  useEffect(() => load(), [load])

  const trips = useMemo(() => (inv ? groupByTrip(inv.lines) : []), [inv])

  if (error) return <p className="glass-lite mx-auto mt-10 max-w-md p-6 text-center text-sm text-[#222222]">{error}</p>
  if (!inv) return <div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>

  const status = statusOf(inv)
  const back = viewer === 'admin' ? '/admin' : '/company'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="no-print flex items-center justify-between gap-3">
        <a href={back} className="text-[13px] font-semibold text-[#0b7f8c]">
          ‹ Back
        </a>
        <button type="button" onClick={() => window.print()} className="glass-btn glass-btn-plain h-10 px-4 text-[13px]">
          Print / Save PDF
        </button>
      </div>

      {viewer === 'admin' && <AdminActions key={`${inv.status}-${inv.payment?.reference ?? ''}`} inv={inv} onDone={load} />}
      {viewer === 'company' && <CompanyActions inv={inv} onDone={load} />}

      <article className="invoice-paper rounded-[20px] bg-white p-5 text-[13px] text-[#100c0d] shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ebe5dc] pb-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-11 w-11" />
            <div className="flex flex-col leading-tight">
              <span className="text-[18px] font-extrabold">BusHub</span>
              <span className="text-[11.5px] text-[#4a4a4a]">bushubbd.com · info@bushubbd.com</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4a4a4a]">Payout invoice</span>
            <span className="font-mono text-[16px] font-extrabold">{inv.number}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.light}`}>{status.label}</span>
          </div>
        </header>

        <section className="grid gap-4 border-b border-[#ebe5dc] py-5 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Paid to</span>
            <span className="text-[15px] font-bold">{inv.companyName}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Trips</span>
            <span className="font-semibold">{inv.from === inv.to ? formatTripDate(inv.from) : `${formatTripDate(inv.from)} – ${formatTripDate(inv.to)}`}</span>
            <span className="text-[11.5px] text-[#4a4a4a]">Made {dhakaDateTime(inv.createdAt)}</span>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-b border-[#ebe5dc] py-5">
          <Row label={`Tickets sold on BusHub (${inv.totals.tickets} tickets, ${inv.totals.seats} seats), original price`} value={taka(inv.totals.ticketTotal)} />
          <Row label="BusHub commission" value={`−${taka(inv.totals.commission)}`} />
          {(inv.totals.refunds || 0) > 0 && (
            <Row label={`Refunded tickets BusHub had already paid for (${inv.deductions.length})`} value={`−${taka(inv.totals.refunds || 0)}`} />
          )}
          <div className="mt-1 rounded-xl bg-[#f3f6f6] px-3.5 py-3">
            <Row label="BusHub pays the company" value={taka(inv.totals.payout)} strong />
          </div>
        </section>

        <section className="flex flex-col gap-4 py-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Every ticket, trip by trip</span>
          {trips.map((t) => (
            <div key={t.key} className="invoice-trip overflow-hidden rounded-xl border border-[#ebe5dc]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-[#f3f6f6] px-3.5 py-2.5">
                <span className="font-bold">
                  {t.first.from} → {t.first.to} · {t.first.departureTime}
                </span>
                <span className="text-[12px] text-[#4a4a4a]">
                  {formatTripDate(t.first.date)} · {t.first.busName}
                </span>
              </div>
              <div className="hidden grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr] gap-2 border-b border-[#ebe5dc] px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#5e5e5e] sm:grid">
                <span>{viewer === 'admin' ? 'Ticket · passenger' : 'Ticket'}</span>
                <span>Seats</span>
                <span className="text-right">Price</span>
                <span className="text-right">Commission</span>
                <span className="text-right">Company gets</span>
              </div>
              {t.lines.map((l) => (
                <div key={l.bookingId} className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-b border-[#eef1f1] px-3.5 py-2 last:border-b-0 sm:grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr] sm:items-baseline">
                  <span className="col-span-2 flex flex-col sm:col-span-1">
                    <span className="font-mono text-[11.5px] font-semibold">{l.code}</span>
                    {l.passengerName && <span className="text-[11.5px] text-[#4a4a4a]">{l.passengerName}</span>}
                  </span>
                  <span className="text-[12px]">
                    <span className="text-[#5e5e5e] sm:hidden">Seats </span>
                    {l.seats.join(', ')}
                  </span>
                  <span className="text-right text-[12px]">
                    <span className="text-[#5e5e5e] sm:hidden">Price </span>
                    {taka(l.ticketPrice)}
                  </span>
                  <span className="text-[12px] text-[#4a4a4a] sm:text-right">
                    <span className="sm:hidden">Commission </span>−{taka(l.commission)}
                  </span>
                  <span className="text-right text-[12.5px] font-bold">
                    <span className="font-normal text-[#5e5e5e] sm:hidden">Company gets </span>
                    {taka(l.payout)}
                  </span>
                </div>
              ))}
              <div className="flex flex-wrap justify-between gap-2 bg-[#fafbfb] px-3.5 py-2 text-[12px]">
                <span className="text-[#4a4a4a]">
                  {t.lines.length} ticket{t.lines.length === 1 ? '' : 's'} · {t.seats} seat{t.seats === 1 ? '' : 's'} · price {taka(t.price)} · commission −{taka(t.commission)}
                </span>
                <span className="font-bold">{taka(t.payout)}</span>
              </div>
            </div>
          ))}
        </section>

        {inv.deductions.length > 0 && (
          <section className="invoice-trip flex flex-col gap-2 pb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Refunds taken back</span>
            <p className="text-[11.5px] text-[#4a4a4a]">These tickets were refunded to the passenger after BusHub had already paid for them, so their payout comes off this payment.</p>
            <div className="overflow-hidden rounded-xl border border-[#ebe5dc]">
              {inv.deductions.map((d) => (
                <div key={d._id} className="flex items-start justify-between gap-3 border-b border-[#eef1f1] px-3.5 py-2 last:border-b-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-[11.5px] font-semibold">{d.code}</span>
                    <span className="text-[11.5px] text-[#4a4a4a]">
                      {d.from} → {d.to} · {formatTripDate(d.date)} {d.departureTime} · seats {d.seats.join(', ')} · paid in {d.paidIn}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-red-700">−{taka(d.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 border-t border-[#ebe5dc] pt-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Payment</span>
            {inv.payment ? (
              <>
                <span className="font-bold">
                  {taka(inv.payment.amount)} {inv.payment.method === 'cash' ? 'in cash' : `by ${PAY_METHOD_LABELS[inv.payment.method]}`}
                </span>
                {inv.payment.reference && (
                  <span>
                    {inv.payment.method === 'cash' ? 'Received by ' : 'Reference '}
                    <span className={inv.payment.method === 'cash' ? 'font-semibold' : 'font-mono font-semibold'}>{inv.payment.reference}</span>
                  </span>
                )}
                <span className="text-[11.5px] text-[#4a4a4a]">{dhakaDateTime(inv.payment.at)}</span>
                {inv.payment.note && <span className="text-[11.5px] text-[#4a4a4a]">{inv.payment.note}</span>}
              </>
            ) : (
              <span className="text-[#4a4a4a]">Not paid yet</span>
            )}
            {inv.approval && (
              <span className="text-[11.5px] text-[#4a4a4a]">
                Tickets approved by the company: {inv.approval.by}, {dhakaDateTime(inv.approval.at)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 sm:items-end sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a4a4a]">Received and signed by the company</span>
            {inv.confirmation ? (
              <>
                <span className="font-[cursive] text-[20px] leading-tight text-[#1d3f8f]">{inv.confirmation.signedBy}</span>
                <span className="text-[11.5px] text-[#4a4a4a]">{dhakaDateTime(inv.confirmation.at)}</span>
              </>
            ) : (
              <span className="text-[#4a4a4a]">Not signed yet</span>
            )}
          </div>
        </section>

        {inv.dispute && inv.status === 'disputed' && (
          <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
            Problem reported by {inv.dispute.by}, {dhakaDateTime(inv.dispute.at)}: {inv.dispute.note}
          </p>
        )}

        <footer className="mt-5 flex flex-col gap-1.5 rounded-xl border border-dashed border-[#d5dbdc] px-3.5 py-3 text-[11.5px] text-[#4a4a4a]">
          <span className={`font-bold ${inv.check.contentOk && inv.check.signatureOk !== false ? 'text-emerald-700' : 'text-red-700'}`}>
            {!inv.check.contentOk
              ? '⚠ This invoice does not match the record it was made from.'
              : inv.check.signatureOk === false
                ? '⚠ Changed after the company signed it.'
                : inv.check.signatureOk
                  ? '✓ Checked: nothing has changed since the company signed it.'
                  : '✓ Checked: the tickets and amounts match the record.'}
          </span>
          <span>
            Fingerprint <span className="break-all font-mono">{inv.contentHash.slice(0, 32)}</span>
          </span>
        </footer>
      </article>

      {inv.history.length > 0 && (
        <div className="no-print glass-lite flex flex-col gap-1.5 p-4 text-[12px]">
          <span className="label-xs">History</span>
          {inv.history.map((h, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-[#222222]">
                {h.event} <span className="text-[#5e5e5e]">· {h.by}</span>
              </span>
              <span className="shrink-0 text-[#5e5e5e]">{dhakaDateTime(h.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#4a4a4a]">Loading...</div>}>
      <InvoiceView />
    </Suspense>
  )
}
