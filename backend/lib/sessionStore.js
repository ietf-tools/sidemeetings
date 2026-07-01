import { EventEmitter } from 'node:events'
import { eq, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { sessions } from '../db/schema.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const PRUNE_INTERVAL_MS = 60 * 60 * 1000 // hourly

/**
 * A Postgres-backed session store for @fastify/session so sessions persist
 * across backend restarts and redeploys.
 *
 * Implements the store contract expected by @fastify/session:
 *   - get(sessionId, cb)     → cb(err, session|null)
 *   - set(sessionId, sess, cb) → cb(err)
 *   - destroy(sessionId, cb) → cb(err)
 *
 * The session object is stored verbatim as JSONB. On read, @fastify/session
 * rebuilds its Cookie (re-hydrating the ISO date strings back into Date
 * objects), so a JSON round-trip is safe.
 */
export class PostgresSessionStore extends EventEmitter {
  constructor({ ttlMs = DEFAULT_TTL_MS, pruneIntervalMs = PRUNE_INTERVAL_MS } = {}) {
    super()
    this.ttlMs = ttlMs

    // Periodically drop expired rows. Unref so the timer never keeps the
    // process alive on shutdown.
    if (pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => {
        this.prune().catch(() => {})
      }, pruneIntervalMs)
      this.pruneTimer.unref?.()
    }
  }

  // Derive the row's expiry from the session cookie, falling back to the TTL.
  #expiryFor(session) {
    const cookie = session?.cookie
    const expiry = cookie?.expires || cookie?.originalExpires
    return expiry ? new Date(expiry) : new Date(Date.now() + this.ttlMs)
  }

  get(sessionId, callback) {
    db.select({ sess: sessions.sess, expire: sessions.expire })
      .from(sessions)
      .where(eq(sessions.sid, sessionId))
      .limit(1)
      .then(([row]) => {
        if (!row) return callback(null, null)
        // Treat expired rows as absent and clean them up lazily.
        if (row.expire && row.expire.getTime() <= Date.now()) {
          this.destroy(sessionId, () => callback(null, null))
          return
        }
        callback(null, row.sess)
      })
      .catch(callback)
  }

  set(sessionId, session, callback) {
    const expire = this.#expiryFor(session)
    db.insert(sessions)
      .values({ sid: sessionId, sess: session, expire })
      .onConflictDoUpdate({ target: sessions.sid, set: { sess: session, expire } })
      .then(() => callback(null))
      .catch(callback)
  }

  destroy(sessionId, callback) {
    db.delete(sessions)
      .where(eq(sessions.sid, sessionId))
      .then(() => callback(null))
      .catch(callback)
  }

  // Delete all rows whose expiry has passed.
  async prune() {
    await db.delete(sessions).where(lt(sessions.expire, new Date()))
  }
}
