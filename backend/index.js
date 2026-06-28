import Fastify from 'fastify'
import FastifyCompress from '@fastify/compress'
import FastifyHelmet from '@fastify/helmet'
import FastifyHttpProxy from '@fastify/http-proxy'
import FastifySensible from '@fastify/sensible'
import FastifyVite from '@fastify/vite'
import path from 'node:path'

/* global process */

const DEV_MODE = !(process.env.NODE_ENV === 'production')

const state = {
  data: {
    meeting: {},
    rooms: [],
    bookings: []
  }
}

const fastify = Fastify({
  logger: true,
  disableRequestLogging: true
})

fastify.register(FastifyCompress)
fastify.register(FastifyHelmet)
fastify.register(FastifySensible)

await fastify.register(FastifyVite, {
  root: path.resolve(import.meta.dirname, '..'),
  dev: DEV_MODE,
  spa: true
})

// API ENDPOINTS
fastify.get('/_health', function (request, reply) {
  reply.send({ ok: true })
})

fastify.get('/_data', function (request, reply) {
  reply.send(state.data)
})

// PGADMIN Proxy (DEV ONLY)
if (DEV_MODE) {
  fastify.register(FastifyHttpProxy, {
    upstream: 'http://pgadmin',
    prefix: '/pgadmin/',
    rewritePrefix: '/pgadmin/'
  })
  fastify.get('/pgadmin', (req, reply) => {
    reply.redirect('/pgadmin/')
  })
}

// Serve Homepage
fastify.get('/', (req, reply) => {
  return reply.html()
})

fastify.setErrorHandler((err, req, reply) => {
  console.error(err)
  reply.send(err)
})

await fastify.vite.ready()

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, _) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
