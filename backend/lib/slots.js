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
 * @param {Temporal.ZonedDateTime} [now] - Current time (defaults to now in the meeting timezone).
 *                                         Slots before now + meeting.minNotice are never offered.
 *
 * @returns {{ [dayOffset: number]: number[] }}
 *   Keys 0–4 (Mon–Fri), values are arrays of available start times in minutes since midnight.
 */
// Smallest bookable side-meeting length (minutes). A gap shorter than this plus
// a buffer can never hold another meeting, so we don't want to create one.
const MIN_DURATION = 60

export function calculateAvailableSlots(room, meeting, existingBookings, duration, buffer, now) {
  const effectiveBuffer = buffer ?? meeting.buffer ?? 15
  const meetingDays = getMeetingDays(meeting)
  const timezone = meeting.timezone

  // Earliest a new booking may start: now + the meeting's minimum notice. Slots
  // on days already in the past, or earlier than this cutoff on the current day,
  // are never offered.
  const nowZdt = now ?? Temporal.Now.zonedDateTimeISO(timezone)
  const cutoffZdt = nowZdt.add({ minutes: meeting.minNotice ?? 0 })
  const cutoffDate = cutoffZdt.toPlainDate()
  const cutoffMin = cutoffZdt.hour * 60 + cutoffZdt.minute

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

    // Skip days entirely before the notice cutoff; on the cutoff day, only offer
    // start times at or after the cutoff minute.
    const dayVsCutoff = Temporal.PlainDate.compare(plainDate, cutoffDate)
    if (dayVsCutoff < 0) {
      result[dayOffset] = []
      continue
    }
    const earliestMin = dayVsCutoff === 0 ? cutoffMin : 0

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
        duration: bd
      }))

    // Buffered end times of existing bookings — the earliest a new meeting may
    // start after each one.
    const bufferedEnds = dayBookings.map((b) => b.startMin + b.duration + effectiveBuffer)

    const slots = []

    for (const window of windows) {
      const windowStart = window.s
      const windowEnd = window.e

      // Candidate start times: every 15 minutes within the window.
      for (let startMin = windowStart; startMin + duration <= windowEnd; startMin += 15) {
        const endMin = startMin + duration

        // Skip start times that fall before the minimum-notice cutoff.
        if (startMin < earliestMin) continue

        // Check conflicts: a conflict exists when the candidate slot overlaps any existing
        // booking when a buffer is applied around each existing booking.
        const hasConflict = dayBookings.some((existing) => {
          const existingBufferedStart = existing.startMin - effectiveBuffer
          const existingBufferedEnd = existing.startMin + existing.duration + effectiveBuffer
          // Overlap check: candidate [startMin, endMin) overlaps buffered existing
          return startMin < existingBufferedEnd && endMin > existingBufferedStart
        })

        if (hasConflict) continue

        // Anti-fragmentation: the free space immediately before this start runs
        // from the latest preceding boundary (window start or a prior booking's
        // buffered end) up to startMin. Only offer the slot if that gap is either
        // zero (flush) or big enough to still hold the smallest possible meeting.
        // Otherwise booking here would strand an unusable gap.
        let regionStart = windowStart
        for (const be of bufferedEnds) {
          if (be <= startMin && be > regionStart) regionStart = be
        }
        const gap = startMin - regionStart
        if (gap === 0 || gap >= MIN_DURATION + effectiveBuffer) {
          slots.push(startMin)
        }
      }
    }

    result[dayOffset] = slots
  }

  return result
}

/**
 * Summarise how a room's weekly availability window is used, accounting for the
 * inter-meeting buffer and the minimum bookable meeting length.
 *
 * @returns {{ windowMinutes: number, bookedMinutes: number, bookableFreeMinutes: number }}
 *   windowMinutes        — total availability across the week
 *   bookedMinutes        — minutes occupied by active (pending/confirmed) bookings
 *   bookableFreeMinutes  — free minutes that could still host a booking (≥ the
 *                          minimum length, once required buffers are removed).
 *   The remainder (window − booked − bookableFree) is "unallocatable": buffers
 *   and gaps too small to ever book.
 */
export function summarizeRoomUsage(room, meeting, existingBookings, buffer) {
  const effectiveBuffer = buffer ?? meeting.buffer ?? 15
  const meetingDays = getMeetingDays(meeting)
  const timezone = meeting.timezone
  const availability =
    Array.isArray(room.availability) && room.availability.length === 5
      ? room.availability
      : [[], [], [], [], []]

  const activeStates = new Set(['pending', 'confirmed'])
  const active = existingBookings.filter((b) => activeStates.has(b.state))

  let windowMinutes = 0
  let bookedMinutes = 0
  let bookableFreeMinutes = 0

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const plainDate = meetingDays[dayOffset]
    const windows = Array.isArray(availability[dayOffset]) ? availability[dayOffset] : []

    // Bookings on this calendar day (in the meeting timezone), as {start, end} minutes.
    const dayBookings = active
      .map((b) => {
        const zdt = Temporal.Instant.from(
          typeof b.startsAt === 'string' ? b.startsAt : b.startsAt.toISOString()
        ).toZonedDateTimeISO(timezone)
        return { zdt, duration: b.duration }
      })
      .filter(({ zdt }) => Temporal.PlainDate.compare(zdt.toPlainDate(), plainDate) === 0)
      .map(({ zdt, duration }) => {
        const start = zdt.hour * 60 + zdt.minute
        return { start, end: start + duration, duration }
      })

    for (const window of windows) {
      const ws = window.s
      const we = window.e
      windowMinutes += Math.max(0, we - ws)

      const within = dayBookings
        .filter((b) => b.end > ws && b.start < we)
        .sort((a, b) => a.start - b.start)

      // Add booked time (clamped to the window).
      for (const b of within) {
        bookedMinutes += Math.max(0, Math.min(b.end, we) - Math.max(b.start, ws))
      }

      // Walk the free gaps; a gap can host a booking only if, after removing the
      // buffer beside any adjacent booking, it still fits the minimum length.
      const addGap = (start, end, leftBooking, rightBooking) => {
        const usable =
          end - start - (leftBooking ? effectiveBuffer : 0) - (rightBooking ? effectiveBuffer : 0)
        if (usable >= MIN_DURATION) bookableFreeMinutes += usable
      }

      let cursor = ws
      for (const b of within) {
        addGap(cursor, b.start, cursor > ws, true)
        cursor = Math.max(cursor, b.end)
      }
      addGap(cursor, we, cursor > ws, false)
    }
  }

  return { windowMinutes, bookedMinutes, bookableFreeMinutes }
}
