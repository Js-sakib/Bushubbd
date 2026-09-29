/** The most bags one booking can declare; more than this is a cargo job, not a passenger's luggage. */
export const MAX_BAGS = 10

/** A bag count from a form or request: a whole number from 0 to MAX_BAGS, anything else is 0. */
export function cleanBags(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(MAX_BAGS, Math.max(0, Math.floor(n)))
}
