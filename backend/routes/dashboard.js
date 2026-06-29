import { db } from '../db/index.js'
import { meetings, rooms, bookings, users, activityLog } from '../db/schema.js'
import { eq, and, count, sql, desc, ilike, or } from 'drizzle-orm'

export default async function dashboardRoutes(fastify) {
  // ── GET /api/dashboard/ ───────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
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
          recentPending: [],
          roomUtilization: [],
          recentActivity: [],
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
        roomName: rooms.name,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.organizerId, users.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(and(eq(bookings.meetingId, meetingId), eq(bookings.state, 'pending')))
      .orderBy(desc(bookings.createdAt))
      .limit(5)

    // Room utilisation.
    const meetingRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.meetingId, meetingId))

    const roomUtilization = await Promise.all(
      meetingRooms.map(async (room) => {
        // Total available minutes: sum all availability windows across 5 days.
        const avail = Array.isArray(room.availability) ? room.availability : [[], [], [], [], []]
        const totalAvailableMinutes = avail.reduce((total, dayWindows) => {
          if (!Array.isArray(dayWindows)) {
            return total
          }
          return total + dayWindows.reduce((sum, w) => sum + (w.e - w.s), 0)
        }, 0)

        // Booked minutes: sum duration of confirmed + pending bookings for this room.
        const [bookedRow] = await db
          .select({ total: sql`COALESCE(SUM(${bookings.duration}), 0)` })
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, room.id),
              or(eq(bookings.state, 'confirmed'), eq(bookings.state, 'pending'))
            )
          )

        return {
          roomId: room.id,
          roomName: room.name,
          color: room.color,
          totalAvailableMinutes,
          bookedMinutes: Number(bookedRow.total),
        }
      })
    )

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
        bookingTitle: bookings.title,
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
      recentPending,
      roomUtilization,
      recentActivity,
    }
  })
}
