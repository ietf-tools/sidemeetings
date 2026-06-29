import { db } from '../db/index.js'
import { rooms, meetings, bookings } from '../db/schema.js'
import { eq, and, sql, or } from 'drizzle-orm'
import { calculateAvailableSlots } from '../lib/slots.js'

/**
 * Generate a URL-safe slug from a name string.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default async function roomsRoutes(fastify) {
  // ── GET /api/meetings/:meetingId/rooms ────────────────────────────────────
  // Rooms for a meeting with booking counts. Admin only.
  fastify.get('/meetings/:meetingId/rooms', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { meetingId } = request.params

    const meeting = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)

    if (!meeting.length) {
      return reply.notFound('Meeting not found')
    }

    const rows = await db
      .select({
        id: rooms.id,
        meetingId: rooms.meetingId,
        name: rooms.name,
        slug: rooms.slug,
        description: rooms.description,
        capacity: rooms.capacity,
        floor: rooms.floor,
        color: rooms.color,
        availability: rooms.availability,
        videoLinkUrl: rooms.videoLinkUrl,
        videoLinkName: rooms.videoLinkName,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
        bookingCount: sql`(SELECT COUNT(*) FROM bookings WHERE bookings.room_id = ${rooms.id})`.mapWith(Number),
        bookedMinutes: sql`(SELECT COALESCE(SUM(duration), 0) FROM bookings WHERE bookings.room_id = ${rooms.id})`.mapWith(Number),
      })
      .from(rooms)
      .where(eq(rooms.meetingId, meetingId))
      .orderBy(rooms.name)

    return rows
  })

  // ── POST /api/meetings/:meetingId/rooms ───────────────────────────────────
  // Create a room for a meeting. Admin only.
  fastify.post('/meetings/:meetingId/rooms', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { meetingId } = request.params

    const meeting = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)

    if (!meeting.length) {
      return reply.notFound('Meeting not found')
    }

    const {
      name,
      slug,
      description,
      capacity,
      floor,
      color,
      availability,
      videoLinkUrl,
      videoLinkName,
    } = request.body

    if (!name) {
      return reply.badRequest('name is required')
    }

    const [room] = await db
      .insert(rooms)
      .values({
        meetingId,
        name,
        slug: slug || slugify(name),
        description: description ?? null,
        capacity: capacity ?? 0,
        floor: floor ?? null,
        color: color ?? 'sky',
        availability: availability ?? [[], [], [], [], []],
        videoLinkUrl: videoLinkUrl ?? null,
        videoLinkName: videoLinkName ?? 'Webex',
      })
      .returning()

    return reply.code(201).send(room)
  })

  // ── GET /api/rooms/:id ────────────────────────────────────────────────────
  // Single room. Admin only.
  fastify.get('/rooms/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1)

    if (!room) {
      return reply.notFound('Room not found')
    }

    return room
  })

  // ── PUT /api/rooms/:id ────────────────────────────────────────────────────
  // Update a room. Admin only.
  fastify.put('/rooms/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('Room not found')
    }

    const {
      name,
      slug,
      description,
      capacity,
      floor,
      color,
      availability,
      videoLinkUrl,
      videoLinkName,
    } = request.body

    const updateData = { updatedAt: new Date() }

    if (name !== undefined) {
      updateData.name = name
    }
    if (slug !== undefined) {
      updateData.slug = slug
    } else if (name !== undefined) {
      updateData.slug = slugify(name)
    }
    if (description !== undefined) {
      updateData.description = description
    }
    if (capacity !== undefined) {
      updateData.capacity = capacity
    }
    if (floor !== undefined) {
      updateData.floor = floor
    }
    if (color !== undefined) {
      updateData.color = color
    }
    if (availability !== undefined) {
      updateData.availability = availability
    }
    if (videoLinkUrl !== undefined) {
      updateData.videoLinkUrl = videoLinkUrl
    }
    if (videoLinkName !== undefined) {
      updateData.videoLinkName = videoLinkName
    }

    const [updated] = await db
      .update(rooms)
      .set(updateData)
      .where(eq(rooms.id, id))
      .returning()

    return updated
  })

  // ── DELETE /api/rooms/:id ─────────────────────────────────────────────────
  // Delete a room (bookings cascade). Admin only.
  fastify.delete('/rooms/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('Room not found')
    }

    await db.delete(rooms).where(eq(rooms.id, id))

    return { success: true }
  })

  // ── GET /api/rooms/:id/slots ──────────────────────────────────────────────
  // Available slots for a room. Requires authentication (not admin-only).
  fastify.get('/rooms/:id/slots', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { id } = request.params
    const { duration, meetingId } = request.query

    if (!duration) {
      return reply.badRequest('duration query param is required')
    }

    const durationMin = parseInt(duration, 10)
    if (isNaN(durationMin) || durationMin <= 0) {
      return reply.badRequest('duration must be a positive integer (minutes)')
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1)

    if (!room) {
      return reply.notFound('Room not found')
    }

    // Resolve the meeting: use meetingId param, or fall back to the room's own meeting.
    const targetMeetingId = meetingId || room.meetingId

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, targetMeetingId))
      .limit(1)

    if (!meeting) {
      return reply.notFound('Meeting not found')
    }

    // Fetch existing bookings for this room.
    const existingBookings = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        duration: bookings.duration,
        state: bookings.state,
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
  })
}
