import 'dotenv/config'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import fastifySensible from '@fastify/sensible'

import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import meetingsRoutes from './routes/meetings.js'
import roomsRoutes from './routes/rooms.js'
import bookingsRoutes from './routes/bookings.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import publicRoutes from './routes/public.js'

const isProd = process.env.NODE_ENV === 'production'

const fastify = Fastify({
  logger: {
    transport: {
      target: isProd ? 'pino' : 'pino-pretty',
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

// ─── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 4000

try {
  await fastify.listen({ port, host: '0.0.0.0' })
  fastify.log.warn(`Server listening on port ${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
