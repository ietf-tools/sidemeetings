/**
 * Slot availability calculation using the Temporal API (native in Node.js 26).
 *
 * Availability windows are stored per day-of-week as arrays of {s, e} objects
 * where s and e are minutes since midnight (e.g. { s: 540, e: 1020 } = 09:00–17:00).
 *
 * The meeting week is defined as Mon–Fri of the ISO week containing meeting.startDate.
 * dayOffset 0 = Monday, 1 = Tuesday, …, 4 = Friday.
 */

/**
 * Convert "HH:MM" string to minutes since midnight.
 * @param {string} hhmm
 * @returns {number}
 */
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert minutes since midnight to "HH:MM" string.
 * @param {number} min
 * @returns {string}
 */
export function minutesToTime(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Return the five PlainDate values (Mon–Fri) for the ISO week that contains
 * meeting.startDate (a "YYYY-MM-DD" string or Temporal.PlainDate).
 *
 * @param {{ startDate: string }} meeting
 * @returns {Temporal.PlainDate[]}
 */
export function getMeetingDays(meeting) {
  const start =
    typeof meeting.startDate === 'string'
      ? Temporal.PlainDate.from(meeting.startDate)
      : meeting.startDate

  // ISO day-of-week: 1=Mon … 7=Sun.  Subtract (dow - 1) days to land on Monday.
  const monday = start.subtract({ days: start.dayOfWeek - 1 })

  return Array.from({ length: 5 }, (_, i) => monday.add({ days: i }))
}

/**
 * Calculate available slot start times for a given room, meeting, and duration.
 *
 * @param {object} room           - Room row from DB (includes .availability and .meetingId)
 * @param {object} meeting        - Meeting row from DB (includes .startDate and .timezone)
 * @param {object[]} existingBookings - Bookings for this room (include .startsAt, .duration, .state)
 * @param {number}  duration      - Desired booking duration in minutes
 * @param {number}  [buffer]      - Buffer between bookings in minutes (falls back to meeting.buffer)
 *
 * @returns {{ [dayOffset: number]: number[] }}
 *   Keys 0–4 (Mon–Fri), values are arrays of available start times in minutes since midnight.
 */
export function calculateAvailableSlots(room, meeting, existingBookings, duration, buffer) {
  const effectiveBuffer = buffer ?? meeting.buffer ?? 15
  const meetingDays = getMeetingDays(meeting)
  const timezone = meeting.timezone

  // Normalise availability – fall back to 5 empty arrays if missing/malformed.
  const availability =
    Array.isArray(room.availability) && room.availability.length === 5
      ? room.availability
      : [[], [], [], [], []]

  // Only consider active (pending or confirmed) bookings for conflict detection.
  const activeStates = new Set(['pending', 'confirmed'])
  const activeBookings = existingBookings.filter((b) => activeStates.has(b.state))

  const result = {}

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const plainDate = meetingDays[dayOffset]
    const windows = Array.isArray(availability[dayOffset]) ? availability[dayOffset] : []

    // Collect existing bookings that fall on this calendar day (in the meeting timezone).
    const dayBookings = activeBookings
      .map((b) => {
        const zdt = Temporal.Instant.from(
          typeof b.startsAt === 'string' ? b.startsAt : b.startsAt.toISOString()
        ).toZonedDateTimeISO(timezone)
        return { zdt, duration: b.duration }
      })
      .filter(({ zdt }) => {
        const bDate = zdt.toPlainDate()
        return Temporal.PlainDate.compare(bDate, plainDate) === 0
      })
      .map(({ zdt, duration: bd }) => ({
        startMin: zdt.hour * 60 + zdt.minute,
        duration: bd,
      }))

    const slots = []

    for (const window of windows) {
      const windowStart = window.s
      const windowEnd = window.e

      // Candidate start times: every 30 minutes within the window.
      for (let startMin = windowStart; startMin + duration <= windowEnd; startMin += 30) {
        const endMin = startMin + duration

        // Check conflicts: a conflict exists when the candidate slot overlaps any existing
        // booking when a buffer is applied around each existing booking.
        const hasConflict = dayBookings.some((existing) => {
          const existingBufferedStart = existing.startMin - effectiveBuffer
          const existingBufferedEnd = existing.startMin + existing.duration + effectiveBuffer
          // Overlap check: candidate [startMin, endMin) overlaps buffered existing
          return startMin < existingBufferedEnd && endMin > existingBufferedStart
        })

        if (!hasConflict) {
          slots.push(startMin)
        }
      }
    }

    result[dayOffset] = slots
  }

  return result
}
