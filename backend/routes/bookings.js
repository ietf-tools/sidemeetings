import { db } from '../db/index.js'
import { bookings, meetings, rooms, users, activityLog } from '../db/schema.js'
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import {
  sendBookingPending,
  sendApproverNotification,
  sendBookingApproved,
  sendBookingRejected
} from '../lib/email.js'

/**
 * Load everything the email templates need for a booking: the booking itself
 * plus its organizer, room and meeting. Returns null if the booking is gone.
 * @param {string} id
 * @returns {Promise<{booking: object, organizer: object, room: object, meeting: object}|null>}
 */
async function loadBookingContext(id) {
  const [row] = await db
    .select({
      id: bookings.id,
      title: bookings.title,
      description: bookings.description,
      state: bookings.state,
      isIrtf: bookings.isIrtf,
      areas: bookings.areas,
      coOrganizers: bookings.coOrganizers,
      startsAt: bookings.startsAt,
      duration: bookings.duration,
      videoLinkUrl: bookings.videoLinkUrl,
      organizerName: users.name,
      organizerEmail: users.email,
      roomName: rooms.name,
      roomVideoLinkName: rooms.videoLinkName,
      roomVideoLinkUrl: rooms.videoLinkUrl,
      meetingNum: meetings.num,
      meetingCity: meetings.city,
      meetingCountry: meetings.country,
      meetingVenue: meetings.venue,
      meetingTimezone: meetings.timezone
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.organizerId, users.id))
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(meetings, eq(bookings.meetingId, meetings.id))
    .where(eq(bookings.id, id))
    .limit(1)

  if (!row) return null

  return {
    booking: {
      id: row.id,
      title: row.title,
      description: row.description,
      state: row.state,
      isIrtf: row.isIrtf,
      areas: row.areas,
      coOrganizers: row.coOrganizers,
      startsAt: row.startsAt,
      duration: row.duration,
      videoLinkUrl: row.videoLinkUrl
    },
    organizer: { name: row.organizerName, email: row.organizerEmail },
    room: {
      name: row.roomName,
      videoLinkName: row.roomVideoLinkName,
      videoLinkUrl: row.roomVideoLinkUrl
    },
    meeting: {
      num: row.meetingNum,
      city: row.meetingCity,
      country: row.meetingCountry,
      venue: row.meetingVenue,
      timezone: row.meetingTimezone
    }
  }
}

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
          // Store only an explicit custom link. When left empty ("Default"),
          // leave it null so the room's *current* link is used at read time —
          // that way changing a room's default updates these bookings too.
          videoLinkUrl: videoLinkUrl || null,
          videoLinkName: videoLinkName || null
        })
        .returning()

      // Log the submission.
      await db.insert(activityLog).values({
        userId,
        bookingId: booking.id,
        action: 'submitted',
        meta: { title: booking.title }
      })

      // Notify the organizer (pending) and the approvers (needs review).
      // Fire-and-forget: email problems must never fail the submission.
      loadBookingContext(booking.id)
        .then((ctx) => {
          if (!ctx) return
          sendBookingPending(ctx, request.log)
          sendApproverNotification(ctx, request.log)
        })
        .catch((err) => request.log.error({ err }, 'submission notifications failed'))

      return reply.code(201).send(booking)
    }
  )

  // ── POST /api/meetings/:meetingId/bookings/manual ─────────────────────────
  // Admin-created booking. The organizer is set by name/email (created as a user
  // if they don't exist yet), and the booking lands in the 'confirmed' state.
  fastify.post(
    '/meetings/:meetingId/bookings/manual',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { meetingId } = request.params
      const adminUserId = request.session.userId

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
        notify
      } = request.body

      if (!roomId || !startsAt || !duration || !title) {
        return reply.badRequest('Missing required fields: roomId, startsAt, duration, title')
      }
      const email = String(organizerEmail || '').trim().toLowerCase()
      const name = String(organizerName || '').trim()
      if (!email) return reply.badRequest('organizerEmail is required')
      if (!name) return reply.badRequest('organizerName is required')

      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)
      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      const [room] = await db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, roomId), eq(rooms.meetingId, meetingId)))
        .limit(1)
      if (!room) {
        return reply.notFound('Room not found in this meeting')
      }

      const conflict = await hasConflict(roomId, startsAt, duration, meeting.buffer)
      if (conflict) {
        return reply.conflict('The requested time slot conflicts with an existing booking')
      }

      // Resolve the organizer by email, creating the user if they don't exist.
      let [organizer] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
      if (!organizer) {
        ;[organizer] = await db.insert(users).values({ name, email }).returning({ id: users.id })
      }

      const [booking] = await db
        .insert(bookings)
        .values({
          meetingId,
          roomId,
          organizerId: organizer.id,
          title,
          description: description ?? null,
          state: 'confirmed',
          isIrtf: isIrtf ?? false,
          areas: isIrtf ? [] : Array.isArray(areas) ? areas : [],
          coOrganizers: Array.isArray(coOrganizers) ? coOrganizers : [],
          startsAt: new Date(startsAt),
          duration,
          videoLinkUrl: videoLinkUrl || null,
          videoLinkName: videoLinkName || null
        })
        .returning()

      await db.insert(activityLog).values({
        userId: adminUserId,
        bookingId: booking.id,
        action: 'confirmed',
        meta: { title: booking.title, manual: true }
      })

      // Optionally notify the organizer + co-organizers (approved, with .ics).
      // Off unless the admin explicitly opts in. Fire-and-forget.
      if (notify) {
        loadBookingContext(booking.id)
          .then((ctx) => {
            if (ctx) sendBookingApproved(ctx, request.log)
          })
          .catch((err) => request.log.error({ err }, 'manual booking notification failed'))
      }

      return reply.code(201).send(booking)
    }
  )

  // ── POST /api/meetings/:meetingId/bookings/import ─────────────────────────
  // Bulk-import bookings from a legacy JSON export into the given meeting.
  // Admin only. Rooms are matched by name; organizers are created as needed.
  // All imported bookings land in the 'confirmed' (approved) state.
  //
  // Skips:  entries titled "UNAVAILABLE", and entries whose room name doesn't
  //         match a room in this meeting.
  // Fails:  entries with invalid dates / missing organizer email, or that error
  //         on insert.
  fastify.post(
    '/meetings/:meetingId/bookings/import',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, reply) => {
      const { meetingId } = request.params

      // Accept either a raw array or an object with a `bookings` array.
      const items = Array.isArray(request.body)
        ? request.body
        : Array.isArray(request.body?.bookings)
          ? request.body.bookings
          : null

      if (!items) {
        return reply.badRequest('Expected a JSON array of bookings (or an object with a "bookings" array)')
      }

      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)
      if (!meeting) {
        return reply.notFound('Meeting not found')
      }

      // Rooms in this meeting, keyed by normalized name for matching.
      const roomRows = await db.select().from(rooms).where(eq(rooms.meetingId, meetingId))
      const roomByName = new Map(roomRows.map((r) => [r.name.trim().toLowerCase(), r]))

      // Resolve organizers by email, creating users on first sight. Cached so a
      // repeated organizer in the payload only hits the DB once.
      const userCache = new Map()
      async function resolveOrganizer(name, email) {
        const key = String(email).trim().toLowerCase()
        if (userCache.has(key)) return userCache.get(key)
        let [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, key)).limit(1)
        if (!user) {
          ;[user] = await db
            .insert(users)
            .values({ name: String(name || '').trim() || key, email: key })
            .returning({ id: users.id })
        }
        userCache.set(key, user.id)
        return user.id
      }

      let imported = 0
      let skipped = 0
      let failed = 0

      for (const b of items) {
        try {
          if (!b || typeof b !== 'object') {
            failed++
            continue
          }
          if (b.title === 'UNAVAILABLE') {
            skipped++
            continue
          }
          const room = roomByName.get(String(b.roomName || '').trim().toLowerCase())
          if (!room) {
            skipped++
            continue
          }

          const start = new Date(b.start)
          const end = new Date(b.end)
          const duration = Math.round((end.getTime() - start.getTime()) / 60_000)
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || duration <= 0) {
            failed++
            continue
          }
          if (!b.organizerEmail) {
            failed++
            continue
          }

          const organizerId = await resolveOrganizer(b.organizerName, b.organizerEmail)

          await db.insert(bookings).values({
            meetingId,
            roomId: room.id,
            organizerId,
            title: String(b.title || 'Untitled').slice(0, 255),
            description: b.description ?? null,
            state: 'confirmed',
            isIrtf: false,
            areas: Array.isArray(b.areas) ? b.areas : [],
            coOrganizers: [],
            startsAt: start,
            duration,
            videoLinkUrl: b.location || room.videoLinkUrl || null,
            videoLinkName: room.videoLinkName || null
          })
          imported++
        } catch (err) {
          request.log.error({ err }, 'booking import: failed to insert an entry')
          failed++
        }
      }

      // One summary entry in the activity log for the import.
      await db.insert(activityLog).values({
        userId: request.session.userId,
        bookingId: null,
        action: 'updated',
        meta: { import: true, meetingId, imported, skipped, failed }
      })

      return { imported, skipped, failed }
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
          // Raw stored value (null = "use room default") so the edit form can
          // tell Default from Custom; roomVideoLinkUrl is the fallback for display.
          videoLinkUrl: bookings.videoLinkUrl,
          videoLinkName: bookings.videoLinkName,
          roomVideoLinkUrl: rooms.videoLinkUrl,
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

      // Notify organizer + co-organizers with an .ics attachment. Fire-and-forget.
      loadBookingContext(id)
        .then((ctx) => {
          if (ctx) sendBookingApproved(ctx, request.log)
        })
        .catch((err) => request.log.error({ err }, 'approval notification failed'))

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

      // Notify the organizer only. Fire-and-forget.
      loadBookingContext(id)
        .then((ctx) => {
          if (ctx) sendBookingRejected(ctx, request.log)
        })
        .catch((err) => request.log.error({ err }, 'rejection notification failed'))

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
