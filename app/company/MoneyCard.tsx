'use client'

import { COST_LABELS, COST_TYPES, taka, type TripMoney } from '@/lib/tripMoney'

export function Line({ label, value, sub, tone = '', strong = false }: { label: string; value: string; sub?: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className={strong ? 'text-[13.5px] font-bold' : 'text-[13px] text-[#c4cdcf]'}>{label}</span>
        {sub && <span className="text-[11px] text-[#6e7b7e]">{sub}</span>}
      </div>
      <span className={`shrink-0 font-bold ${strong ? 'text-[16px]' : 'text-[13.5px]'} ${tone}`}>{value}</span>
    </div>
  )
}

const costsText = (m: TripMoney) =>
  COST_TYPES.filter((t) => m.costs[t] > 0)
    .map((t) => `${COST_LABELS[t].en} ${taka(m.costs[t])}`)
    .join(' · ') || 'None entered yet'

/** The money for a set of trips: what tickets brought in, what BusHub keeps, the costs and what is left. */
export default function MoneyCard({ m, trips, forAdmin = false }: { m: TripMoney; trips: number; forAdmin?: boolean }) {
  return (
    <div className="card-2 flex flex-col gap-3 px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="label-xs">Ticket money</span>
          <span className="display text-[28px] font-bold leading-tight">{taka(m.ticketMoney)}</span>
        </div>
        <span className="pb-1 text-right text-[11.5px] text-[#9ba7aa]">
          {m.seats.online + m.seats.counter} seats sold
          <br />
          {trips} trip{trips === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
        <Line label="Counter tickets" sub={`${m.counter.seats} seats · full price, no BusHub fee`} value={taka(m.counter.total)} tone="text-[#c4b5fd]" />
        <Line label="BusHub tickets" sub={`${m.online.tickets} tickets · ${m.seats.online} seats · what passengers paid`} value={taka(m.online.total)} tone="text-[#f5a524]" />
        <Line label={forAdmin ? 'BusHub commission' : 'BusHub fee'} value={`${forAdmin ? '' : '−'}${taka(m.online.fee)}`} tone={forAdmin ? 'text-[#34d399]' : 'text-[#9ba7aa]'} />
        <Line label={forAdmin ? 'BusHub pays the companies' : 'You get from BusHub'} value={taka(m.online.payout)} tone="text-[#f5a524]" />
      </div>
      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
        <Line label={forAdmin ? 'Companies receive' : 'You receive'} sub={forAdmin ? 'Counter money + BusHub payouts' : 'Counter money + what BusHub pays you'} value={taka(m.companyGets)} strong />
        <Line label="Costs" sub={costsText(m)} value={`−${taka(m.costs.total)}`} tone="text-[#fca5a5]" />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#12756c]/50 to-[#0e5a54]/40 px-3.5 py-3">
        <span className="text-[13.5px] font-bold">Left after costs</span>
        <span className={`display text-[20px] font-bold ${m.left < 0 ? 'text-[#f87171]' : 'text-[#5eead4]'}`}>{taka(m.left)}</span>
      </div>
    </div>
  )
}
