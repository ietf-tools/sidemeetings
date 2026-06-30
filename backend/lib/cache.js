/**
 * Tiny in-memory cache for public read endpoints.
 *
 * Public endpoints (schedule, meetings list, calendar feed) are read constantly
 * but only change when an admin mutates data. We memoise their results and clear
 * the whole cache on any mutating (non-GET) request, so reads avoid the DB until
 * something actually changes. A short TTL acts as a safety net.
 */

const store = new Map()
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Return a cached value, or compute + store it via `producer` on a miss.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} producer
 * @param {number} [ttlMs]
 * @returns {Promise<T>}
 */
export async function cached(key, producer, ttlMs = DEFAULT_TTL_MS) {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) {
    return hit.value
  }
  const value = await producer()
  store.set(key, { value, expires: Date.now() + ttlMs })
  return value
}

/** Drop everything (called when admin data changes). */
export function invalidatePublicCache() {
  store.clear()
}
