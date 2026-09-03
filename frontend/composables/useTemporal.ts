import 'temporal-polyfill/full/global'

export function useTemporal() {
  function minutesToTime(min: number): string {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function formatDateRange(start: string, end: string): string {
    const s = Temporal.PlainDate.from(start)
    const e = Temporal.PlainDate.from(end)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (s.month === e.month && s.year === e.year) {
      return `${monthNames[s.month - 1]} ${s.day}–${e.day}, ${s.year}`
    }
    return `${shortMonths[s.month - 1]} ${s.day} – ${shortMonths[e.month - 1]} ${e.day}, ${e.year}`
  }

  function getMeetingDays(meeting: { startDate: string }): Array<{ label: string; date: string; offset: number }> {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const start = Temporal.PlainDate.from(meeting.startDate)
    const monday = start.subtract({ days: start.dayOfWeek - 1 })
    return Array.from({ length: 5 }, (_, i) => {
      const date = monday.add({ days: i })
      return {
        label: `${dayNames[i]} ${date.day}`,
        date: date.toString(),
        offset: i,
      }
    })
  }

  function formatSubmittedAt(iso: string, tz?: string): string {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    try {
      const instant = Temporal.Instant.from(iso)
      const zdt = instant.toZonedDateTimeISO(tz || 'UTC')
      const month = shortMonths[zdt.month - 1]
      const day = zdt.day
      const hour = String(zdt.hour).padStart(2, '0')
      const min = String(zdt.minute).padStart(2, '0')
      const tzLabel = tz ? zdt.timeZoneId : 'UTC'
      return `${month} ${day} at ${hour}:${min} ${tzLabel}`
    } catch {
      return iso
    }
  }

  function submissionsStatus(meeting: { allowRequestsFrom: string | null; startDate: string }): 'not-open' | 'open' | 'closed' {
    if (!meeting.allowRequestsFrom) return 'not-open'
    try {
      const now = Temporal.Now.instant()
      const opensAt = Temporal.Instant.from(meeting.allowRequestsFrom)
      const meetingStart = Temporal.PlainDate.from(meeting.startDate)
        .toZonedDateTime({ timeZone: 'UTC', plainTime: Temporal.PlainTime.from('00:00') })
        .toInstant()

      if (Temporal.Instant.compare(now, opensAt) < 0) return 'not-open'
      if (Temporal.Instant.compare(now, meetingStart) > 0) return 'closed'
      return 'open'
    } catch {
      return 'not-open'
    }
  }

  return { minutesToTime, formatDateRange, getMeetingDays, formatSubmittedAt, submissionsStatus }
}
