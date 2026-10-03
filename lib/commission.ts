import { ObjectId, type Db } from 'mongodb'
import { dhakaDate } from './scan'
import { DEFAULT_COMMISSION_RATE } from './tickets'

/**
 * BusHub's commission is set once per bus company, when the admin adds the company, and every
 * bus and trip of the company uses it. The admin can change it later (Admin → Companies): trips
 * still to come use the new rate from their next sale, tickets already sold keep their split.
 */

export const MAX_COMMISSION_RATE = 50

/** A commission typed by the admin, as a number from 0 to 50; null if it isn't one. */
export function parseRate(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const rate = Number(String(value).replace('%', '').trim())
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_COMMISSION_RATE ? Math.round(rate * 100) / 100 : null
}

/**
 * The company's commission. Companies added before it moved to the company have none stored:
 * they get the rate their buses already had, so nothing changes for them.
 */
export function effectiveRate(company: Record<string, unknown> | null | undefined, fleetRate?: unknown): number {
  if (company && Number.isFinite(company.commissionRate)) return Number(company.commissionRate)
  if (Number.isFinite(fleetRate)) return Number(fleetRate)
  return DEFAULT_COMMISSION_RATE
}

export async function companyRate(db: Db, companyId: string): Promise<number> {
  if (!ObjectId.isValid(companyId)) return DEFAULT_COMMISSION_RATE
  const [company, bus] = await Promise.all([
    db.collection('companies').findOne({ _id: new ObjectId(companyId) }, { projection: { commissionRate: 1 } }),
    db.collection('fleet').findOne({ companyId, commissionRate: { $type: 'number' } }, { projection: { commissionRate: 1 } }),
  ])
  return effectiveRate(company, bus?.commissionRate)
}

/** Changes a company's commission: the company, its buses and its trips still to come. */
export async function setCompanyRate(db: Db, companyId: string, rate: number, by: string) {
  const at = new Date().toISOString()
  const result = await db
    .collection('companies')
    .updateOne({ _id: new ObjectId(companyId) }, { $set: { commissionRate: rate }, $push: { commissionHistory: { rate, at, by } } } as any)
  if (result.matchedCount === 0) return false
  await db.collection('fleet').updateMany({ companyId }, { $set: { commissionRate: rate } })
  await db.collection('buses').updateMany({ companyId, date: { $gte: dhakaDate() } }, { $set: { commissionRate: rate } })
  return true
}
