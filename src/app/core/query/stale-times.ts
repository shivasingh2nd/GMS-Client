/** Per-resource staleTimes (ms) for GMS query cache. */
export const STALE = {
  distributors: 30 * 60_000,
  items: 30 * 60_000,
  parties: 2 * 60_000,
  consumers: 10 * 60_000,
  consumerLookup: 30_000,
  dacs: 60_000,
  purchases: 60_000,
  entries: 60_000,
  summary: 60_000,
  ledger: 30_000,
  users: 5 * 60_000,
} as const;

export const GC_TIME = 30 * 60_000;
