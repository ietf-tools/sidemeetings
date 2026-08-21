interface RequestWindowMeeting {
  isActive?: boolean
  allowRequestsFrom?: string | null
  endDate?: string
  timezone?: string
}

/**
 * Why side-meeting requests can't be submitted right now, or '' when they can.
 * Requests are only accepted for the active meeting, between its submission
 * open date and the end of its last day (in the meeting's own timezone).
 *
 * Shared by the public homepage and the /manage header so both buttons agree.
 */
export function requestWindowReason(meeting: RequestWindowMeeting | null | undefined): string {
  if (!meeting) return 'No active meeting'
  if (!meeting.isActive) return 'Requests are only open for the current meeting'
  try {
    const now = Temporal.Now.instant()
    if (!meeting.allowRequestsFrom) return 'Side meeting requests are not open yet'
    if (Temporal.Instant.compare(now, Temporal.Instant.from(meeting.allowRequestsFrom)) < 0) {
      return "Side meeting requests haven't opened yet"
    }
    const endInstant = Temporal.PlainDate.from(meeting.endDate!)
      .toZonedDateTime({
        timeZone: meeting.timezone || 'UTC',
        plainTime: Temporal.PlainTime.from('23:59:59')
      })
      .toInstant()
    if (Temporal.Instant.compare(now, endInstant) > 0) return 'This meeting has ended'
  } catch {
    return 'Side meeting requests are not open'
  }
  return ''
}
