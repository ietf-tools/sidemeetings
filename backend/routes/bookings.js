import { db } from '../db/index.js'
import { bookings, meetings, rooms, users, activityLog } from '../db/schema.js'
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'

/**
 * Check whether a proposed booking conflicts with existing bookings.
 * A conflict occurs when the proposed slot overlaps any existing (pending/confirmed) booking
 * in the same room, accounting for the meeting's buffer time.
 *
 * @param {string} roomId
 * @param {Date|string} startsAt
 * @param {number} duration  - minutes
 * @param {number} buffer    - minutes
 * @param {string|null} excludeBookingId - ignore this booking (for edits)
 * @returns {Promise<boolean>}
 */
async function hasConflict(roomId, startsAt, duration, buffer, excludeBookingId = null) {
  const startTs = new Date(startsAt)
  const endTs = new Date(startTs.getTime() + duration * 60_000)
  const bufferMs = buffer * 60_000

  const bufferedStart = new Date(startTs.getTime() - bufferMs)
  const bufferedEnd = new Date(endTs.getTime() + bufferMs)

  // Find any booking in the same room whose interval overlaps our buffered window.
  const conditions = [
    eq(bookings.roomId, roomId),
    or(eq(bookings.state, 'pending'), eq(bookings.state, 'confirmed')),
    // existing booking starts before our buffered end AND ends after our buffered start
    sql`${bookings.startsAt} < ${bufferedEnd.toISOString()}`,
    sql`${bookings.endsAt} > ${bufferedStart.toISOString()}`
  ]

  if (excludeBookingId) {
    conditions.push(sql`${bookings.id} != ${excludeBookingId}`)
  }

  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))
    .limit(1)

  return conflicts.length > 0
}

/**
 * Whether a meeting is currently accepting side-meeting requests: between its
 * submission open date and the end of the meeting (in the meeting's time zone).
 * @param {object} meeting
 * @returns {boolean}
 */
function withinSubmissionWindow(meeting) {
  if (!meeting.allowRequestsFrom) return false
  try {
    const now = Temporal.Now.instant()
    const opensAtIso =
      meeting.allowRequestsFrom instanceof Date
        ? meeting.allowRequestsFrom.toISOString()
        : meeting.allowRequestsFrom
    if (Temporal.Instant.compare(now, Temporal.Instant.from(opensAtIso)) < 0) return false
    const endInstant = Temporal.PlainDate.from(meeting.endDate)
      .toZonedDateTime({
        timeZone: meeting.timezone || 'UTC',
        plainTime: Temporal.PlainTime.from('23:59:59')
      })
      .toInstant()
    return Temporal.Instant.compare(now, endInstant) <= 0
  } catch {
    return false
  }
}

export default async function bookingsRoutes(fastify) {
  // ── GET /api/meetings/:meetingId/bookings ─────────────────────────────────
  // All bookings for a meeting with organiser info and room name. Admin only.
  fastify.get(
    '/meetings/:meetingId/bookings',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { meetingId } = request.params
      const { state, search } = request.query

      const meeting = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1)

      if (!meeting.length) {
        return reply.notFound('Meeting not found')
      }

      const conditions = [eq(bookings.meetingId, meetingId)]

      if (state) {
        conditions.push(eq(bookings.state, state))
      }

      if (search) {
        conditions.push(ilike(bookings.title, `%${search}%`))
      }

      const rows = await db
        .select({
          id: bookings.id,
          meetingId: bookings.meetingId,
          roomId: bookings.roomId,
          roomName: rooms.name,
          organizerId: bookings.organizerId,
          organizerName: users.name,
          organizerEmail: users.email,
          title: bookings.title,
          description: bookings.description,
          state: bookings.state,
          isIrtf: bookings.isIrtf,
          areas: bookings.areas,
          coOrganizers: bookings.coOrganizers,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          endsAt: bookings.endsAt,
          videoLinkUrl: bookings.videoLinkUrl,
          videoLinkName: bookings.videoLinkName,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.organizerId, users.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(...conditions))
        .orderBy(desc(bookings.startsAt))

      return rows
    }
  )

  // ── POST /api/meetings/:meetingId/bookings ────────────────────────────────
  // Create a booking for the current user.
  fastify.post(
    '/meetings/:meetingId/bookings',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { meetingId } = request.params
      const userId = request.session.userId

      const {
        roomId,
        startsAt,
        duration,
        title,
        description,
        isIrtf,
        areas,
        coOrganizers,
        videoLinkUrl,
        videoLinkName
      } = request.body

      if (!roomId || !startsAt || !duration || !title) {
        return reply.badRequest('Missing required fields: roomId, startsAt, duration, title')
      }

      // Verify the meeting exists.
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)

      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      // Enforce the submission window. Admins may submit outside it.
      if (!request.session.isAdmin && !withinSubmissionWindow(meeting)) {
        return reply.forbidden('Side meeting requests are not currently open for this meeting')
      }

      // Verify the room exists and belongs to this meeting.
      const [room] = await db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, roomId), eq(rooms.meetingId, meetingId)))
        .limit(1)

      if (!room) {
        return reply.notFound('Room not found in this meeting')
      }

      // Check for scheduling conflicts.
      const conflict = await hasConflict(roomId, startsAt, duration, meeting.buffer)
      if (conflict) {
        return reply.conflict('The requested time slot conflicts with an existing booking')
      }

      const [booking] = await db
        .insert(bookings)
        .values({
          meetingId,
          roomId,
          organizerId: userId,
          title,
          description: description ?? null,
          state: 'pending',
          isIrtf: isIrtf ?? false,
          areas: areas ?? [],
          coOrganizers: coOrganizers ?? [],
          startsAt: new Date(startsAt),
          duration,
          // Fall back to the room's configured video tool link when the organizer
          // leaves the custom link empty ("Default" option).
          videoLinkUrl: videoLinkUrl || room.videoLinkUrl || null,
          videoLinkName: videoLinkName || room.videoLinkName || null
        })
        .returning()

      // Log the submission.
      await db.insert(activityLog).values({
        userId,
        bookingId: booking.id,
        action: 'submitted',
        meta: { title: booking.title }
      })

      return reply.code(201).send(booking)
    }
  )

  // ── GET /api/bookings/:id ─────────────────────────────────────────────────
  // Get a booking. Admin sees all; user sees own only.
  fastify.get(
    '/bookings/:id',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.session.userId
      const isAdmin = request.session.isAdmin

      const [booking] = await db
        .select({
          id: bookings.id,
          meetingId: bookings.meetingId,
          roomId: bookings.roomId,
          roomName: rooms.name,
          organizerId: bookings.organizerId,
          organizerName: users.name,
          organizerEmail: users.email,
          title: bookings.title,
          description: bookings.description,
          state: bookings.state,
          isIrtf: bookings.isIrtf,
          areas: bookings.areas,
          coOrganizers: bookings.coOrganizers,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          endsAt: bookings.endsAt,
          videoLinkUrl: bookings.videoLinkUrl,
          videoLinkName: bookings.videoLinkName,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.organizerId, users.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.id, id))
        .limit(1)

      if (!booking) {
        return reply.notFound('Booking not found')
      }

      if (!isAdmin && booking.organizerId !== userId) {
        return reply.forbidden('You do not have access to this booking')
      }

      return booking
    }
  )

  // ── PUT /api/bookings/:id ─────────────────────────────────────────────────
  // Full edit of a booking. Admin only.
  fastify.put(
    '/bookings/:id',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params
      const adminUserId = request.session.userId

      const [existing] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1)

      if (!existing) {
        return reply.notFound('Booking not found')
      }

      const {
        roomId,
        startsAt,
        duration,
        title,
        description,
        isIrtf,
        areas,
        coOrganizers,
        organizerName,
        organizerEmail,
        videoLinkUrl,
        videoLinkName,
        state
      } = request.body

      const updateData = { updatedAt: new Date() }

      // Reassign the main organizer. Organizers are keyed by email: link to the
      // existing user with that address, or create one with the given name.
      if (organizerEmail !== undefined) {
        const email = String(organizerEmail).trim().toLowerCase()
        const name = String(organizerName ?? '').trim()
        if (!email) {
          return reply.badRequest('organizerEmail cannot be empty')
        }

        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        if (existingUser) {
          updateData.organizerId = existingUser.id
        } else {
          if (!name) {
            return reply.badRequest('organizerName is required to create a new organizer')
          }
          const [createdUser] = await db
            .insert(users)
            .values({ name, email })
            .returning({ id: users.id })
          updateData.organizerId = createdUser.id
        }
      }

      if (title !== undefined) {
        updateData.title = title
      }
      if (description !== undefined) {
        updateData.description = description
      }
      if (isIrtf !== undefined) {
        updateData.isIrtf = isIrtf
      }
      if (areas !== undefined) {
        updateData.areas = areas
      }
      if (coOrganizers !== undefined) {
        updateData.coOrganizers = coOrganizers
      }
      if (videoLinkUrl !== undefined) {
        updateData.videoLinkUrl = videoLinkUrl
      }
      if (videoLinkName !== undefined) {
        updateData.videoLinkName = videoLinkName
      }
      if (state !== undefined) {
        updateData.state = state
      }
      if (roomId !== undefined) {
        updateData.roomId = roomId
      }
      if (startsAt !== undefined) {
        updateData.startsAt = new Date(startsAt)
      }
      if (duration !== undefined) {
        updateData.duration = duration
      }

      // If time/room changed, re-check for conflicts.
      const newRoomId = roomId ?? existing.roomId
      const newStartsAt = startsAt ? new Date(startsAt) : existing.startsAt
      const newDuration = duration ?? existing.duration

      const [meeting] = await db
        .select({ buffer: meetings.buffer })
        .from(meetings)
        .where(eq(meetings.id, existing.meetingId))
        .limit(1)

      if (roomId !== undefined || startsAt !== undefined || duration !== undefined) {
        const conflict = await hasConflict(newRoomId, newStartsAt, newDuration, meeting.buffer, id)
        if (conflict) {
          return reply.conflict('The updated time slot conflicts with an existing booking')
        }
      }

      const [updated] = await db
        .update(bookings)
        .set(updateData)
        .where(eq(bookings.id, id))
        .returning()

      // Log the update.
      await db.insert(activityLog).values({
        userId: adminUserId,
        bookingId: id,
        action: 'updated',
        meta: { changes: Object.keys(updateData).filter((k) => k !== 'updatedAt') }
      })

      return updated
    }
  )

  // ── PATCH /api/bookings/:id/confirm ──────────────────────────────────────
  // Confirm a booking. Admin only.
  fastify.patch(
    '/bookings/:id/confirm',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params
      const adminUserId = request.session.userId

      const [existing] = await db
        .select({ id: bookings.id, state: bookings.state, title: bookings.title })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1)

      if (!existing) {
        return reply.notFound('Booking not found')
      }

      const [updated] = await db
        .update(bookings)
        .set({ state: 'confirmed', updatedAt: new Date() })
        .where(eq(bookings.id, id))
        .returning()

      await db.insert(activityLog).values({
        userId: adminUserId,
        bookingId: id,
        action: 'confirmed',
        meta: { previousState: existing.state }
      })

      return updated
    }
  )

  // ── PATCH /api/bookings/:id/reject ────────────────────────────────────────
  // Reject a booking. Admin only.
  fastify.patch(
    '/bookings/:id/reject',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { id } = request.params
      const adminUserId = request.session.userId

      const [existing] = await db
        .select({ id: bookings.id, state: bookings.state })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1)

      if (!existing) {
        return reply.notFound('Booking not found')
      }

      const [updated] = await db
        .update(bookings)
        .set({ state: 'rejected', updatedAt: new Date() })
        .where(eq(bookings.id, id))
        .returning()

      await db.insert(activityLog).values({
        userId: adminUserId,
        bookingId: id,
        action: 'rejected',
        meta: { previousState: existing.state }
      })

      return updated
    }
  )

  // ── PATCH /api/bookings/:id/cancel ────────────────────────────────────────
  // Cancel a booking. Admin can cancel any; user can cancel own only.
  fastify.patch(
    '/bookings/:id/cancel',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.session.userId
      const isAdmin = request.session.isAdmin

      const [existing] = await db
        .select({ id: bookings.id, state: bookings.state, organizerId: bookings.organizerId })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1)

      if (!existing) {
        return reply.notFound('Booking not found')
      }

      if (!isAdmin && existing.organizerId !== userId) {
        return reply.forbidden('You can only cancel your own bookings')
      }

      const [updated] = await db
        .update(bookings)
        .set({ state: 'cancelled', updatedAt: new Date() })
        .where(eq(bookings.id, id))
        .returning()

      await db.insert(activityLog).values({
        userId,
        bookingId: id,
        action: 'cancelled',
        meta: { previousState: existing.state }
      })

      return updated
    }
  )
}
