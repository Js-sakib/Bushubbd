import type { Db } from 'mongodb'

/**
 * Counts requests per visitor or per phone number (lost-ticket requests, for one), so nobody
 * can send them again and again. Counters sit in the database (the site runs on many servers at
 * once) in fixed ten-minute windows, and the database deletes them once they are old.
 */
export const WINDOW_MS = 10 * 60 * 1000

function bucketId(key: string, at = Date.now()) {
  const bucket = Math.floor(at / WINDOW_MS)
  return { id: `${key}|${bucket}`, expiresAt: new Date((bucket + 2) * WINDOW_MS) }
}

/** True when this key has used up its wrong tries for the current window. */
export async function tooManyMisses(db: Db, key: string, limit: number): Promise<boolean> {
  const doc = await db.collection<{ _id: string; count: number }>('rate_limits').findOne({ _id: bucketId(key).id })
  return (doc?.count ?? 0) >= limit
}

export async function recordMiss(db: Db, key: string): Promise<void> {
  const { id, expiresAt } = bucketId(key)
  await db
    .collection<{ _id: string; count: number; expiresAt: Date }>('rate_limits')
    .updateOne({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true })
}

/** The visitor's address as Vercel passes it on. */
export function clientIp(headers: Headers): string {
  return (headers.get('x-forwarded-for') || '').split(',')[0].trim() || headers.get('x-real-ip') || 'unknown'
}
