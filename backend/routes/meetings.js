import { db } from '../db/index.js'
import { meetings, rooms, bookings } from '../db/schema.js'
import { eq, desc, count, sql } from 'drizzle-orm'

export default async function meetingsRoutes(fastify) {
  // ── GET /api/meetings/ ────────────────────────────────────────────────────
  // All meetings with room and booking counts. Admin only.
  fastify.get(
    '/',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const rows = await db
        .select({
          id: meetings.id,
          num: meetings.num,
          city: meetings.city,
          country: meetings.country,
          venue: meetings.venue,
          timezone: meetings.timezone,
          startDate: meetings.startDate,
          endDate: meetings.endDate,
          allowRequestsFrom: meetings.allowRequestsFrom,
          isActive: meetings.isActive,
          buffer: meetings.buffer,
          minNotice: meetings.minNotice,
          createdAt: meetings.createdAt,
          updatedAt: meetings.updatedAt,
          roomCount:
            sql`(SELECT COUNT(*) FROM rooms WHERE rooms.meeting_id = ${meetings.id})`.mapWith(
              Number
            ),
          bookingCount:
            sql`(SELECT COUNT(*) FROM bookings WHERE bookings.meeting_id = ${meetings.id})`.mapWith(
              Number
            )
        })
        .from(meetings)
        .orderBy(desc(meetings.startDate))

      return rows
    }
  )

  // ── POST /api/meetings/ ───────────────────────────────────────────────────
  // Create a meeting. Admin only.
  fastify.post(
    '/',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const {
        num,
        city,
        country,
        venue,
        timezone,
        startDate,
        endDate,
        allowRequestsFrom,
        buffer,
        minNotice
      } = request.body

      if (!num || !city || !country || !venue || !timezone || !startDate || !endDate) {
        return reply.badRequest(
          'Missing required fields: num, city, country, venue, timezone, startDate, endDate'
        )
      }

      const [meeting] = await db
        .insert(meetings)
        .values({
          num,
          city,
          country,
          venue,
          timezone,
          startDate,
          endDate,
          allowRequestsFrom: allowRequestsFrom ? new Date(allowRequestsFrom) : null,
          buffer: buffer ?? 15,
          minNotice: minNotice ?? 60
        })
        .returning()

      return reply.code(201).send(meeting)
    }
  )

  // ── GET /api/meetings/:id ─────────────────────────────────────────────────
  // Single meeting. Admin only.
  fastify.get(
    '/:id',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params

      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1)

      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      return meeting
    }
  )

  // ── PUT /api/meetings/:id ─────────────────────────────────────────────────
  // Update a meeting. Admin only.
  fastify.put(
    '/:id',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.id, id))
        .limit(1)

      if (!existing.length) {
        return reply.notFound('Meeting not found')
      }

      const {
        num,
        city,
        country,
        venue,
        timezone,
        startDate,
        endDate,
        allowRequestsFrom,
        buffer,
        minNotice
      } = request.body

      const updateData = {
        updatedAt: new Date()
      }

      if (num !== undefined) {
        updateData.num = num
      }
      if (city !== undefined) {
        updateData.city = city
      }
      if (country !== undefined) {
        updateData.country = country
      }
      if (venue !== undefined) {
        updateData.venue = venue
      }
      if (timezone !== undefined) {
        updateData.timezone = timezone
      }
      if (startDate !== undefined) {
        updateData.startDate = startDate
      }
      if (endDate !== undefined) {
        updateData.endDate = endDate
      }
      if (allowRequestsFrom !== undefined) {
        updateData.allowRequestsFrom = allowRequestsFrom ? new Date(allowRequestsFrom) : null
      }
      if (buffer !== undefined) {
        updateData.buffer = buffer
      }
      if (minNotice !== undefined) {
        updateData.minNotice = minNotice
      }

      const [updated] = await db
        .update(meetings)
        .set(updateData)
        .where(eq(meetings.id, id))
        .returning()

      return updated
    }
  )

  // ── DELETE /api/meetings/:id ──────────────────────────────────────────────
  // Delete a meeting (cascade handled by DB). Admin only.
  fastify.delete(
    '/:id',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.id, id))
        .limit(1)

      if (!existing.length) {
        return reply.notFound('Meeting not found')
      }

      await db.delete(meetings).where(eq(meetings.id, id))

      return { success: true }
    }
  )

  // ── PATCH /api/meetings/:id/activate ─────────────────────────────────────
  // Set this meeting as the active one (deactivates all others). Admin only.
  fastify.patch(
    '/:id/activate',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.id, id))
        .limit(1)

      if (!existing.length) {
        return reply.notFound('Meeting not found')
      }

      // Deactivate all meetings, then activate the target.
      await db.update(meetings).set({ isActive: false, updatedAt: new Date() })
      const [activated] = await db
        .update(meetings)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(meetings.id, id))
        .returning()

      return activated
    }
  )
}
