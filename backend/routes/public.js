import { db } from '../db/index.js'
import { meetings, rooms, bookings, users } from '../db/schema.js'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { calculateAvailableSlots } from '../lib/slots.js'
import { cached } from '../lib/cache.js'

// ─── OpenAPI response schemas ──────────────────────────────────────────────────
// Shared JSON Schema fragments describing the shapes returned by the public,
// unauthenticated endpoints. Attaching these to the routes both documents them
// in Swagger UI (/api/docs) and lets Fastify serialize responses efficiently.

const meetingSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    num: { type: 'string', description: 'IETF meeting number, e.g. "126"' },
    city: { type: 'string' },
    country: { type: 'string' },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    isActive: { type: 'boolean', description: 'Whether this is the current meeting' }
  }
}

const meetingSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    num: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string' },
    venue: { type: 'string' },
    timezone: { type: 'string', description: 'IANA timezone name, e.g. "Asia/Bangkok"' },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    allowRequestsFrom: { type: ['string', 'null'], format: 'date-time' },
    isActive: { type: 'boolean' },
    buffer: { type: 'integer', description: 'Minutes enforced between bookings' },
    minNotice: { type: 'integer', description: 'Minimum minutes of notice before a slot' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
}

const roomSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    capacity: { type: 'integer' },
    color: { type: 'string' },
    availability: {
      description:
        'Weekly availability windows, Mon-Fri (5 arrays). Each window is ' +
        '{ s, e } in minutes since midnight (meeting timezone).',
      type: 'array'
    }
  }
}

const scheduleBookingSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    roomId: { type: 'string', format: 'uuid' },
    roomName: { type: 'string' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    isIrtf: { type: 'boolean' },
    areas: { type: 'array', items: { type: 'string' } },
    organizerName: { type: 'string' },
    organizerEmail: { type: 'string' },
    coOrganizers: { type: 'array' },
    startsAt: { type: 'string', format: 'date-time' },
    duration: { type: 'integer', description: 'Duration in minutes' },
    endsAt: { type: ['string', 'null'], format: 'date-time' },
    videoLinkUrl: { type: ['string', 'null'] },
    videoLinkName: { type: ['string', 'null'] }
  }
}

export default async function publicRoutes(fastify) {
  // ── GET /api/public/schedule ──────────────────────────────────────────────
  // Public, unauthenticated view of the active meeting, its rooms, and all
  // confirmed bookings. Powers the public side-meetings landing page.
  fastify.get(
    '/schedule',
    {
      schema: {
        tags: ['Public'],
        summary: 'Get the schedule for a meeting',
        description:
          'Returns a meeting together with its rooms and all confirmed bookings. ' +
          'Without a `meetingId` the currently active meeting is used.',
        querystring: {
          type: 'object',
          properties: {
            meetingId: {
              type: 'string',
              format: 'uuid',
              description: 'Meeting id. Defaults to the active meeting when omitted.'
            }
          }
        },
        response: {
          200: {
            description: 'The meeting, its rooms and confirmed bookings',
            type: 'object',
            properties: {
              meeting: meetingSchema,
              rooms: { type: 'array', items: roomSchema },
              bookings: { type: 'array', items: scheduleBookingSchema }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { meetingId } = request.query

      const result = await cached(`schedule:${meetingId || 'active'}`, async () => {
        const [meeting] = await db
          .select()
          .from(meetings)
          .where(meetingId ? eq(meetings.id, meetingId) : eq(meetings.isActive, true))
          .limit(1)

        if (!meeting) return null

        const meetingRooms = await db
          .select({
            id: rooms.id,
            name: rooms.name,
            description: rooms.description,
            capacity: rooms.capacity,
            color: rooms.color,
            availability: rooms.availability
          })
          .from(rooms)
          .where(eq(rooms.meetingId, meeting.id))
          .orderBy(rooms.name)

        const bookingRows = await db
          .select({
            id: bookings.id,
            roomId: bookings.roomId,
            roomName: rooms.name,
            title: bookings.title,
            description: bookings.description,
            isIrtf: bookings.isIrtf,
            areas: bookings.areas,
            organizerName: users.name,
            organizerEmail: users.email,
            coOrganizers: bookings.coOrganizers,
            startsAt: bookings.startsAt,
            duration: bookings.duration,
            endsAt: bookings.endsAt,
            // Fall back to the room's video link when the booking has none ("Default").
            videoLinkUrl: sql`COALESCE(${bookings.videoLinkUrl}, ${rooms.videoLinkUrl})`,
            videoLinkName: sql`COALESCE(${bookings.videoLinkName}, ${rooms.videoLinkName})`
          })
          .from(bookings)
          .innerJoin(rooms, eq(bookings.roomId, rooms.id))
          .innerJoin(users, eq(bookings.organizerId, users.id))
          .where(and(eq(bookings.meetingId, meeting.id), eq(bookings.state, 'confirmed')))
          .orderBy(bookings.startsAt)

        return { meeting, rooms: meetingRooms, bookings: bookingRows }
      })

      if (!result) {
        return reply.notFound(meetingId ? 'Meeting not found' : 'No active meeting found')
      }
      return result
    }
  )

  // ── GET /api/public/meetings ──────────────────────────────────────────────
  // Public list of meetings for the schedule picker (most recent first).
  fastify.get(
    '/meetings',
    {
      schema: {
        tags: ['Public'],
        summary: 'List meetings',
        description: 'Lists all meetings, most recent first.',
        response: {
          200: {
            type: 'array',
            items: meetingSummarySchema
          }
        }
      }
    },
    async () => {
      return cached('meetings:list', () =>
        db
          .select({
            id: meetings.id,
            num: meetings.num,
            city: meetings.city,
            country: meetings.country,
            startDate: meetings.startDate,
            endDate: meetings.endDate,
            isActive: meetings.isActive
          })
          .from(meetings)
          .orderBy(desc(meetings.startDate))
      )
    }
  )

  // ── GET /api/public/meetings/active ───────────────────────────────────────
  // Get the currently active meeting. Requires authentication.
  fastify.get(
    '/meetings/active',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const [meeting] = await db.select().from(meetings).where(eq(meetings.isActive, true)).limit(1)

      if (!meeting) {
        return reply.notFound('No active meeting found')
      }

      return meeting
    }
  )

  // ── GET /api/public/meetings/:id/rooms ────────────────────────────────────
  // Rooms for a specific meeting. Requires authentication.
  fastify.get(
    '/meetings/:id/rooms',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params

      const [meeting] = await db
        .select({ id: meetings.id, isActive: meetings.isActive })
        .from(meetings)
        .where(eq(meetings.id, id))
        .limit(1)

      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      const meetingRooms = await db
        .select({
          id: rooms.id,
          meetingId: rooms.meetingId,
          name: rooms.name,
          slug: rooms.slug,
          description: rooms.description,
          capacity: rooms.capacity,
          color: rooms.color,
          availability: rooms.availability,
          videoLinkUrl: rooms.videoLinkUrl,
          videoLinkName: rooms.videoLinkName
        })
        .from(rooms)
        .where(eq(rooms.meetingId, id))
        .orderBy(rooms.name)

      return meetingRooms
    }
  )

  // ── GET /api/public/rooms/:id/slots ───────────────────────────────────────
  // Available slots for a room. Requires authentication.
  fastify.get(
    '/rooms/:id/slots',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params
      const { duration } = request.query

      if (!duration) {
        return reply.badRequest('duration query param is required')
      }

      const durationMin = parseInt(duration, 10)
      if (isNaN(durationMin) || durationMin <= 0) {
        return reply.badRequest('duration must be a positive integer (minutes)')
      }

      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1)

      if (!room) {
        return reply.notFound('Room not found')
      }

      const [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, room.meetingId))
        .limit(1)

      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      const existingBookings = await db
        .select({
          id: bookings.id,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          state: bookings.state
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.roomId, id),
            or(eq(bookings.state, 'pending'), eq(bookings.state, 'confirmed'))
          )
        )

      const slots = calculateAvailableSlots(room, meeting, existingBookings, durationMin)

      return { slots }
    }
  )

  // ── GET /api/public/bookings/mine ─────────────────────────────────────────
  // Current user's bookings. Requires authentication.
  fastify.get(
    '/bookings/mine',
    {
      preHandler: fastify.authenticate
    },
    async (request, _reply) => {
      const userId = request.session.userId

      const myBookings = await db
        .select({
          id: bookings.id,
          meetingId: bookings.meetingId,
          roomId: bookings.roomId,
          roomName: rooms.name,
          title: bookings.title,
          description: bookings.description,
          state: bookings.state,
          isIrtf: bookings.isIrtf,
          areas: bookings.areas,
          coOrganizers: bookings.coOrganizers,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          endsAt: bookings.endsAt,
          // Fall back to the room's current video link when the booking has none ("Default").
          videoLinkUrl: sql`COALESCE(${bookings.videoLinkUrl}, ${rooms.videoLinkUrl})`,
          videoLinkName: sql`COALESCE(${bookings.videoLinkName}, ${rooms.videoLinkName})`,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.organizerId, userId))
        .orderBy(desc(bookings.startsAt))

      return myBookings
    }
  )

  // ── GET /api/public/bookings/:id ──────────────────────────────────────────
  // Current user's own booking only. Requires authentication.
  fastify.get(
    '/bookings/:id',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.session.userId

      const [booking] = await db
        .select({
          id: bookings.id,
          meetingId: bookings.meetingId,
          roomId: bookings.roomId,
          roomName: rooms.name,
          organizerId: bookings.organizerId,
          title: bookings.title,
          description: bookings.description,
          state: bookings.state,
          isIrtf: bookings.isIrtf,
          areas: bookings.areas,
          coOrganizers: bookings.coOrganizers,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          endsAt: bookings.endsAt,
          // Fall back to the room's current video link when the booking has none ("Default").
          videoLinkUrl: sql`COALESCE(${bookings.videoLinkUrl}, ${rooms.videoLinkUrl})`,
          videoLinkName: sql`COALESCE(${bookings.videoLinkName}, ${rooms.videoLinkName})`,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(eq(bookings.id, id), eq(bookings.organizerId, userId)))
        .limit(1)

      if (!booking) {
        return reply.notFound('Booking not found')
      }

      return booking
    }
  )
}
