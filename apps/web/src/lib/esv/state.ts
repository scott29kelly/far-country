/**
 * In-memory state for the /api/esv proxy.
 *
 * Lives in a non-route module because Next route files can only export
 * HTTP method handlers and a small set of route-config values — adding a
 * `_resetForTests` export to the route file breaks the build. Keeping the
 * mutable state and its test helper here lets the route stay clean and
 * lets tests import the reset helper without violating route conventions.
 *
 * Caveat: in-memory state on a serverless runtime is per-instance only.
 * Acceptable for personal-study scale (spec §5 E5).
 */

export type CacheEntry = {
  reference: string;
  text: string;
  expiresAt: number;
};

export const cache = new Map<string, CacheEntry>();
export const rateBuckets = new Map<string, number[]>();

export const CACHE_TTL_MS = 60 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const RATE_LIMIT_MAX = 30;

export function resetEsvProxyState(): void {
  cache.clear();
  rateBuckets.clear();
}
