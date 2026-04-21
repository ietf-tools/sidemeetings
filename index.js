import Fastify from 'fastify'
import FastifyCompress from '@fastify/compress'
import FastifyHelmet from '@fastify/helmet'
import FastifySensible from '@fastify/sensible'
// import FastifyStatic from '@fastify/static'
import FastifyVite from '@fastify/vite'
// import path from 'node:path'
import meeting from './meeting.json' with { type: 'json' }
// import fs from 'node:fs/promises'

/* global process */

const DEV_MODE = !(process.env.NODE_ENV === 'production')

const state = {
  data: {
    meeting,
    rooms: [],
    bookings: []
  },
  fetchedAt: null,
  isFetching: false
}

const fastify = Fastify({
  logger: true,
  disableRequestLogging: true
})

fastify.register(FastifyCompress)
fastify.register(FastifyHelmet)
fastify.register(FastifySensible)
// fastify.register(FastifyStatic, {
//   root: path.join(import.meta.dirname, 'dist')
// })
await fastify.register(FastifyVite, {
  root: import.meta.dirname,
  dev: DEV_MODE,
  spa: true
})

fastify.get('/_health', function (request, reply) {
  reply.send({ ok: true })
})

fastify.get('/_data', function (request, reply) {
  reply.send(state.data)
})

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

async function fetchCalData() {
  state.isFetching = true
  try {
    // FETCH ROOMS
    console.info(`${new Date().toISOString()} - Fetching rooms...`)
    let resp = await fetch(
      `https://api.cal.com/v2/organizations/${process.env.CAL_ORG_ID}/teams/${process.env.CAL_TEAM_ID}/event-types`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CAL_API_KEY}`
        }
      }
    ).then((r) => r.json())
    if (resp?.status !== 'success') {
      throw new Error(resp?.error ?? 'Invalid Response')
    }
    state.data.rooms = resp.data.map((bk) => ({
      id: bk.id,
      title: bk.title,
      description: bk.description,
      slug: bk.slug
    }))
    console.info(`${new Date().toISOString()} - Fetched ${resp.data?.length ?? 0} rooms.`)

    // FETCH BOOKINGS
    console.info(`${new Date().toISOString()} - Fetching bookings...`)
    resp = await fetch(
      `https://api.cal.com/v2/organizations/${process.env.CAL_ORG_ID}/teams/${process.env.CAL_TEAM_ID}/bookings?take=250&status=upcoming,recurring,past`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CAL_API_KEY}`
        }
      }
    ).then((r) => r.json())
    if (resp?.status !== 'success') {
      throw new Error(resp?.error ?? 'Invalid Response')
    }
    state.data.bookings = resp.data
      .filter((bk) => bk.status !== 'pending')
      .map((bk) => ({
        id: bk.id,
        roomId: bk.eventType.id,
        roomName: state.data.rooms.find((r) => r.id === bk.eventType.id)?.title,
        title: bk.bookingFieldsResponses.title,
        description: bk.description,
        start: bk.start,
        end: bk.end,
        location: bk.location,
        organizerName: bk.bookingFieldsResponses.name,
        organizerEmail: bk.bookingFieldsResponses.email,
        areas: bk.bookingFieldsResponses.areas ?? bk.bookingFieldsResponses.Areas ?? []
      }))
    console.info(
      `${new Date().toISOString()} - Fetched ${resp.data?.length ?? 0} bookings, ${state.data.bookings?.length ?? 0} are confirmed.`
    )

    // await fs.writeFile('125.json', JSON.stringify(state.data, null, 2), 'utf8')
  } catch (err) {
    console.warn(err)
  }
  state.isFetching = false
}

if (!DEV_MODE) {
  setInterval(() => {
    if (state.isFetching) {
      return
    }
    fetchCalData()
  }, 60000)
}

fetchCalData()
