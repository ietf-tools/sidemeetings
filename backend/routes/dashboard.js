import { db } from '../db/index.js'
import { meetings, rooms, bookings, users, activityLog } from '../db/schema.js'
import { eq, and, count, sql, desc, or, isNotNull } from 'drizzle-orm'
import { summarizeRoomUsage } from '../lib/slots.js'

export default async function dashboardRoutes(fastify) {
  // ── GET /api/dashboard/ ───────────────────────────────────────────────────
  fastify.get(
    '/',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, _reply) => {
      const { viewMeetingId } = request.query

      // Resolve which meeting to scope the dashboard to.
      let meetingId = viewMeetingId

      if (!meetingId) {
        const activeMeeting = await db
          .select({ id: meetings.id })
          .from(meetings)
          .where(eq(meetings.isActive, true))
          .limit(1)

        if (!activeMeeting.length) {
          // No active meeting; return empty dashboard.
          return {
            meetingId: null,
            pendingCount: 0,
            confirmedCount: 0,
            roomCount: 0,
            pendingDescriptionCount: 0,
            recentPending: [],
            pendingDescriptions: [],
            roomUtilization: [],
            recentActivity: []
          }
        }

        meetingId = activeMeeting[0].id
      }

      // Count pending bookings.
      const [pendingRow] = await db
        .select({ cnt: count() })
        .from(bookings)
        .where(and(eq(bookings.meetingId, meetingId), eq(bookings.state, 'pending')))

      // Count confirmed bookings.
      const [confirmedRow] = await db
        .select({ cnt: count() })
        .from(bookings)
        .where(and(eq(bookings.meetingId, meetingId), eq(bookings.state, 'confirmed')))

      // Count rooms.
      const [roomRow] = await db
        .select({ cnt: count() })
        .from(rooms)
        .where(eq(rooms.meetingId, meetingId))

      // 5 most recent pending bookings with organiser name and room name.
      const recentPending = await db
        .select({
          id: bookings.id,
          title: bookings.title,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          state: bookings.state,
          createdAt: bookings.createdAt,
          organizerName: users.name,
          organizerEmail: users.email,
          roomId: bookings.roomId,
          roomName: rooms.name
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.organizerId, users.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(eq(bookings.meetingId, meetingId), eq(bookings.state, 'pending')))
        .orderBy(desc(bookings.createdAt))
        .limit(5)

      // Description changes submitted by organizers of approved bookings, which
      // stay unpublished until an admin decides on them.
      const [pendingDescriptionRow] = await db
        .select({ cnt: count() })
        .from(bookings)
        .where(and(eq(bookings.meetingId, meetingId), isNotNull(bookings.pendingDescription)))

      const pendingDescriptions = await db
        .select({
          id: bookings.id,
          title: bookings.title,
          state: bookings.state,
          description: bookings.description,
          pendingDescription: bookings.pendingDescription,
          pendingDescriptionAt: bookings.pendingDescriptionAt,
          organizerName: users.name,
          roomName: rooms.name
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.organizerId, users.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(eq(bookings.meetingId, meetingId), isNotNull(bookings.pendingDescription)))
        .orderBy(desc(bookings.pendingDescriptionAt))
        .limit(5)

      // Room utilisation (buffer- and minimum-length-aware).
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)

      const meetingRooms = await db.select().from(rooms).where(eq(rooms.meetingId, meetingId))

      const utilBookings = await db
        .select({
          roomId: bookings.roomId,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          state: bookings.state
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.meetingId, meetingId),
            or(eq(bookings.state, 'confirmed'), eq(bookings.state, 'pending'))
          )
        )

      const bookingsByRoom = new Map()
      for (const b of utilBookings) {
        if (!bookingsByRoom.has(b.roomId)) bookingsByRoom.set(b.roomId, [])
        bookingsByRoom.get(b.roomId).push(b)
      }

      const roomUtilization = meetingRooms.map((room) => {
        const usage = summarizeRoomUsage(
          room,
          meeting,
          bookingsByRoom.get(room.id) || [],
          meeting.buffer
        )
        return {
          roomId: room.id,
          roomName: room.name,
          color: room.color,
          totalAvailableMinutes: usage.windowMinutes,
          bookedMinutes: usage.bookedMinutes,
          bookableFreeMinutes: usage.bookableFreeMinutes
        }
      })

      // Last 10 activity log entries with user name and booking title.
      const recentActivity = await db
        .select({
          id: activityLog.id,
          action: activityLog.action,
          meta: activityLog.meta,
          createdAt: activityLog.createdAt,
          userName: users.name,
          userEmail: users.email,
          bookingId: activityLog.bookingId,
          bookingTitle: bookings.title
        })
        .from(activityLog)
        .leftJoin(users, eq(activityLog.userId, users.id))
        .leftJoin(bookings, eq(activityLog.bookingId, bookings.id))
        .where(
          // Only log entries related to this meeting's bookings.
          sql`${activityLog.bookingId} IN (
          SELECT id FROM bookings WHERE meeting_id = ${meetingId}
        )`
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(10)

      return {
        meetingId,
        pendingCount: Number(pendingRow.cnt),
        confirmedCount: Number(confirmedRow.cnt),
        roomCount: Number(roomRow.cnt),
        pendingDescriptionCount: Number(pendingDescriptionRow.cnt),
        recentPending,
        pendingDescriptions,
        roomUtilization,
        recentActivity
      }
    }
  )
}
