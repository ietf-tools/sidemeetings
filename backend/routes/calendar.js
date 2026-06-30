import { db } from '../db/index.js'
import { meetings, rooms, bookings } from '../db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { cached } from '../lib/cache.js'

/**
 * Format a JS Date as an iCalendar UTC timestamp: 20260720T080000Z
 */
function icsStamp(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** Escape a value for inclusion in an iCalendar text field. */
function escapeIcs(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold long lines to 75 octets per RFC 5545 (simple char-based folding). */
function fold(line) {
  if (line.length <= 75) return line
  const parts = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

export default async function calendarRoutes(fastify) {
  // ── GET /calendar/:file ───────────────────────────────────────────────────
  // Public iCalendar subscription feed for a meeting, addressed by meeting
  // number, e.g. /calendar/126.ics. Recomputed on every request so subscribers
  // always see the latest confirmed bookings.
  fastify.get('/:file', async (request, reply) => {
    const { file } = request.params
    const match = /^(.+)\.ics$/i.exec(file || '')
    if (!match) {
      return reply.notFound('Calendar not found')
    }
    const num = match[1]

    const result = await cached(`calendar:${num}`, async () => {
      const [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.num, num))
        .limit(1)

      if (!meeting) return null

      const rows = await db
        .select({
          id: bookings.id,
          title: bookings.title,
          description: bookings.description,
          roomName: rooms.name,
          startsAt: bookings.startsAt,
          duration: bookings.duration,
          updatedAt: bookings.updatedAt,
          videoLinkUrl: sql`COALESCE(${bookings.videoLinkUrl}, ${rooms.videoLinkUrl})`,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(eq(bookings.meetingId, meeting.id), eq(bookings.state, 'confirmed')))
        .orderBy(bookings.startsAt)

      const calName = `IETF ${meeting.num} Side Meetings`
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IETF Side Meetings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        fold(`X-WR-CALNAME:${escapeIcs(calName)}`),
        'X-PUBLISHED-TTL:PT1H',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      ]

      for (const b of rows) {
        const start = new Date(b.startsAt)
        const end = new Date(start.getTime() + b.duration * 60 * 1000)
        const desc = (b.description || '') + (b.videoLinkUrl ? `\n\nJoin: ${b.videoLinkUrl}` : '')
        lines.push('BEGIN:VEVENT')
        lines.push(`UID:${b.id}@sidemeetings.ietf.org`)
        lines.push(`DTSTAMP:${icsStamp(b.updatedAt || start)}`)
        lines.push(`DTSTART:${icsStamp(start)}`)
        lines.push(`DTEND:${icsStamp(end)}`)
        lines.push(fold(`SUMMARY:${escapeIcs(b.title)}`))
        lines.push(fold(`LOCATION:${escapeIcs(b.roomName)}`))
        if (desc.trim()) lines.push(fold(`DESCRIPTION:${escapeIcs(desc)}`))
        if (b.videoLinkUrl) lines.push(fold(`URL:${escapeIcs(b.videoLinkUrl)}`))
        lines.push('END:VEVENT')
      }

      lines.push('END:VCALENDAR')
      return { num: meeting.num, body: lines.join('\r\n') }
    })

    if (!result) {
      return reply.notFound('Meeting not found')
    }

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `inline; filename="ietf-${result.num}.ics"`)
      .header('Cache-Control', 'public, max-age=300')
      .send(result.body)
  })
}
