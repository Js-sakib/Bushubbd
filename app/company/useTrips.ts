'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { CompanyTrip, TripsData } from './types'

/**
 * The company's trips, refreshed every 20 seconds so online and counter sales show up live.
 * The manager gets the last 30 days; `since` (a date) reaches further back.
 */
export function useTrips(since = '') {
  const [data, setData] = useState<TripsData | null>(null)
  const load = useCallback(async () => {
    const res = await fetch(`/api/company/trips${since ? `?since=${since}` : ''}`, { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    if (json && !json.error) setData(json)
  }, [since])
  useEffect(() => {
    load()
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [load])
  return { data, reload: load, setData }
}

/** Sell or free one seat at the counter, then refresh. */
export async function changeSeat(trip: CompanyTrip, seat: string, action: 'sell' | 'unsell'): Promise<boolean> {
  const res = await fetch(`/api/company/trips/${trip._id}/seats`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seats: [seat], action }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    toast.error(json?.error || 'Could not change the seat')
    return false
  }
  toast.success(action === 'sell' ? `Seat ${seat} sold at the counter` : `Seat ${seat} is free again`)
  return true
}
