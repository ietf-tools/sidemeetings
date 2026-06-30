import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import fastifySensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'

import { db, runMigrations } from './db/index.js'
import { users } from './db/schema.js'

import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import meetingsRoutes from './routes/meetings.js'
import roomsRoutes from './routes/rooms.js'
import bookingsRoutes from './routes/bookings.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import publicRoutes from './routes/public.js'
import calendarRoutes from './routes/calendar.js'
import { invalidatePublicCache } from './lib/cache.js'

const isProd = process.env.NODE_ENV === 'production'

const fastify = Fastify({
  logger: isProd
    ? true
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            ignore: 'pid,hostname'
          }
        }
      }
})

// ─── Plugins ──────────────────────────────────────────────────────────────────

await fastify.register(fastifyCors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']
})

await fastify.register(fastifyCookie)

await fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: isProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  },
  saveUninitialized: false
})

await fastify.register(fastifySensible)

// ─── Auth decorators ──────────────────────────────────────────────────────────

fastify.decorate('authenticate', async function authenticate(request, reply) {
  if (!request.session.userId) {
    return reply.unauthorized('Authentication required')
  }
})

fastify.decorate('authenticateAdmin', async function authenticateAdmin(request, reply) {
  if (!request.session.userId) {
    return reply.unauthorized('Authentication required')
  }
  if (!request.session.isAdmin) {
    return reply.forbidden('Admin access required')
  }
})

// ─── Public cache invalidation ──────────────────────────────────────────────
// Any successful mutating request (admin create/update/delete, booking actions,
// etc.) drops the public read cache so the schedule/calendar reflect changes
// immediately. Read-only GET/HEAD requests leave the cache intact.
fastify.addHook('onResponse', async (request, reply) => {
  const method = request.method
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && reply.statusCode < 400) {
    invalidatePublicCache()
  }
})

// ─── Routes ───────────────────────────────────────────────────────────────────

await fastify.register(authRoutes, { prefix: '/api/auth' })

await fastify.register(dashboardRoutes, {
  prefix: '/api/dashboard'
})

await fastify.register(meetingsRoutes, { prefix: '/api/meetings' })

await fastify.register(roomsRoutes, { prefix: '/api' })

await fastify.register(bookingsRoutes, { prefix: '/api' })

await fastify.register(usersRoutes, { prefix: '/api/users' })

await fastify.register(settingsRoutes, { prefix: '/api/settings' })

await fastify.register(publicRoutes, { prefix: '/api/public' })

await fastify.register(calendarRoutes, { prefix: '/calendar' })

// ─── Static client (SPA) ──────────────────────────────────────────────────────
// Serve the precompiled Nuxt SPA from the same origin as the API. Registered
// after the API/calendar routes so those always win. `nuxt generate` emits the
// client into ../.output/public, including a 200.html SPA fallback. Requests for
// real assets are served directly; any other unmatched GET falls back to the SPA
// entrypoint so client-side routing (e.g. /admin/rooms) resolves on the browser.
const clientDir = join(dirname(fileURLToPath(import.meta.url)), '../.output/public')

if (existsSync(clientDir)) {
  await fastify.register(fastifyStatic, {
    root: clientDir,
    wildcard: false
  })

  fastify.setNotFoundHandler((request, reply) => {
    if (
      request.method !== 'GET' ||
      request.url.startsWith('/api') ||
      request.url.startsWith('/calendar')
    ) {
      return reply.notFound()
    }
    return reply.sendFile('200.html')
  })

  fastify.log.warn(`Serving static client from ${clientDir}`)
} else {
  fastify.log.warn(`No client build at ${clientDir} — running API only (run "npm run build")`)
}

// ─── Database migrations ──────────────────────────────────────────────────────
// Optionally apply pending Drizzle migrations on boot. Enabled with
// AUTO_MIGRATE=true so single-container deployments stay schema-current without a
// separate migration job; leave it unset when migrations run as a dedicated step.
// Runs before admin seeding, which depends on the tables existing.
if (process.env.AUTO_MIGRATE === 'true') {
  fastify.log.warn('AUTO_MIGRATE enabled — applying pending migrations…')
  await runMigrations()
  fastify.log.warn('Database migrations up to date')
}

// ─── Initial admin seeding ──────────────────────────────────────────────────
// On a fresh deployment the database has no users, so nobody can log in and
// promote others to admin. If SETUP_ADMIN_EMAIL is set and the users table is
// empty, seed a single admin with that email. On their first OAuth login the
// auth callback upserts by email and links the account, preserving admin rights.
async function seedInitialAdmin() {
  const email = process.env.SETUP_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) return

  const existing = await db.select({ id: users.id }).from(users).limit(1)
  if (existing.length > 0) return

  await db.insert(users).values({
    email,
    name: 'Administrator',
    isAdmin: true,
    isActive: true
  })

  fastify.log.warn(`Seeded initial admin account: ${email}`)
}

await seedInitialAdmin()

// ─── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.BACKEND_PORT) || 4000

try {
  await fastify.listen({ port, host: '0.0.0.0' })
  fastify.log.warn(`Server listening on port ${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
