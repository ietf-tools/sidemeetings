import nodemailer from 'nodemailer'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const SETTINGS_ID = 1
const SUPPORT_EMAIL = 'support@ietf.org'
// Shared "need help?" footer, included on every email except the approver one.
const SUPPORT_FOOTER_HTML = `If you have any questions, please contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`
const SUPPORT_FOOTER_TEXT = `If you have any questions, please contact ${SUPPORT_EMAIL}.`

// ─── SMTP transport ───────────────────────────────────────────────────────────
// Built once, lazily, from environment variables. Returns null when SMTP isn't
// configured (e.g. local dev) so callers degrade gracefully instead of crashing.
//
//   SMTP_HOST   - SMTP server hostname (required to enable email)
//   SMTP_PORT   - port (default 587)
//   SMTP_SECURE - "true" for implicit TLS (typically port 465)
//   SMTP_USER   - auth username (optional; omit for unauthenticated relays)
//   SMTP_PASS   - auth password
//   SMTP_FROM   - fallback From address when Settings has no fromEmail
//   SMTP_TLS_REJECT_UNAUTHORIZED - "false" disables TLS certificate validation
//                                  (self-signed/mismatched certs). Insecure —
//                                  use only on trusted staging relays.
let cachedTransport
let transportResolved = false

function getTransport() {
  if (transportResolved) return cachedTransport
  transportResolved = true

  const host = process.env.SMTP_HOST
  if (!host) {
    cachedTransport = null
    return null
  }

  const port = Number(process.env.SMTP_PORT) || 587
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Applies to both implicit TLS and STARTTLS upgrades. Defaults to secure
    // (validate certs); set SMTP_TLS_REJECT_UNAUTHORIZED=false to disable.
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' }
  })
  return cachedTransport
}

// From/Reply-To/approvers come from the Settings row so admins can change them
// without a restart; From falls back to SMTP_FROM / SMTP_USER.
async function getMailSettings() {
  let row = null
  try {
    ;[row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1)
  } catch {
    row = null
  }
  return {
    // Notifications are on unless an admin has explicitly disabled them.
    emailEnabled: row ? row.emailEnabled !== false : true,
    from: row?.fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER || null,
    replyTo: row?.replyTo || undefined,
    approvers: Array.isArray(row?.approvers) ? row.approvers.filter(Boolean) : []
  }
}

async function send(
  { to, subject, html, text, attachments, replyTo, from, enabled = true },
  logger = console
) {
  const transport = getTransport()
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)

  if (!enabled) {
    logger.info?.(`[email] notifications disabled — skipping "${subject}"`)
    return false
  }
  if (!transport) {
    logger.warn?.(`[email] SMTP not configured — skipping "${subject}"`)
    return false
  }
  if (!recipients.length) return false
  if (!from) {
    logger.warn?.('[email] no From address (set fromEmail in Settings or SMTP_FROM) — skipping')
    return false
  }

  try {
    await transport.sendMail({ from, to: recipients, subject, html, text, attachments, replyTo })
    logger.info?.(`[email] sent "${subject}" to ${recipients.join(', ')}`)
    return true
  } catch (err) {
    logger.error?.({ err }, `[email] failed to send "${subject}"`)
    return false
  }
}

// ─── Formatting helpers ─────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(instant, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'UTC'
    }).format(new Date(instant))
  } catch {
    return new Date(instant).toUTCString()
  }
}

function fmtTime(instant, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'UTC',
      timeZoneName: 'short'
    }).format(new Date(instant))
  } catch {
    return ''
  }
}

// Returns [label, value] rows describing the booking, shared by every template.
// videoMode controls the video-link row:
//   'off'       — omit it (default)
//   'effective' — show the real link (booking's custom, else the room default)
//   'requested' — show the custom link if provided, else the text "Use room default"
//                 so approvers can see whether a custom link was supplied
function detailRows(ctx, { includePeople = false, videoMode = 'off' } = {}) {
  const { booking, room, meeting, organizer } = ctx
  const start = new Date(booking.startsAt)
  const end = new Date(start.getTime() + booking.duration * 60_000)
  const tz = meeting.timezone || 'UTC'

  const rows = [
    ['Meeting', `IETF ${meeting.num} — ${meeting.city}, ${meeting.country}`],
    ['Room', room.name],
    ['When', `${fmtDate(start, tz)} – ${fmtTime(end, tz)}`],
    ['Duration', `${booking.duration} minutes`]
  ]

  if (booking.isIrtf) rows.push(['Type', 'IRTF'])
  else if (booking.areas?.length) rows.push(['Area(s)', booking.areas.join(', ')])

  if (includePeople) {
    rows.push(['Organizer', `${organizer.name} <${organizer.email}>`])
    const cos = Array.isArray(booking.coOrganizers) ? booking.coOrganizers : []
    if (cos.length) {
      rows.push([
        'Co-organizers',
        cos.map((c) => (c.email ? `${c.name} <${c.email}>` : c.name)).join(', ')
      ])
    }
  }

  // Video link row (see videoMode above). Not shown on every notice.
  const videoLabel = room.videoLinkName || 'Video link'
  if (videoMode === 'effective') {
    const videoUrl = booking.videoLinkUrl || room.videoLinkUrl
    if (videoUrl) rows.push([videoLabel, videoUrl])
  } else if (videoMode === 'requested') {
    rows.push([videoLabel, booking.videoLinkUrl || 'Use room default'])
  }
  if (booking.description) rows.push(['Description', booking.description])

  return rows
}

function layout({
  heading,
  intro,
  ctx,
  includePeople = false,
  videoMode = 'off',
  // Extra [label, value] rows appended after the standard booking details.
  extraRows = [],
  buttonUrl,
  buttonLabel,
  footer
}) {
  const rowsHtml = [...detailRows(ctx, { includePeople, videoMode }), ...extraRows]
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:7px 14px 7px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td>
          <td style="padding:7px 0;color:#111827;font-size:14px;line-height:1.5">${esc(v)}</td>
        </tr>`
    )
    .join('')

  const button = buttonUrl
    ? `<div style="margin:28px 0 4px">
         <a href="${esc(buttonUrl)}" style="display:inline-block;background:#0a5ea8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px">${esc(buttonLabel || 'Open')}</a>
       </div>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="background:#0a5ea8;padding:18px 28px;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.3px">IETF Side Meetings</td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827">${esc(heading)}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151">${intro}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:4px 0">
            ${rowsHtml}
          </table>
          ${button}
          ${footer ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280">${footer}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5">This is an automated message from the IETF Side Meetings scheduler.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function plainText({
  heading,
  introText,
  ctx,
  includePeople = false,
  videoMode = 'off',
  extraRows = [],
  buttonUrl,
  footerText
}) {
  const lines = [heading, '', introText, '']
  for (const [k, v] of [...detailRows(ctx, { includePeople, videoMode }), ...extraRows]) {
    lines.push(`${k}: ${v}`)
  }
  if (buttonUrl) lines.push('', buttonUrl)
  if (footerText) lines.push('', footerText)
  return lines.join('\n')
}

// ─── ICS calendar attachment ─────────────────────────────────────────────────

function icsStamp(d) {
  // 20260720T130000Z
  return new Date(d)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function icsEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Fold long lines to <=75 octets per RFC 5545.
function icsFold(line) {
  if (line.length <= 74) return line
  const parts = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 73))
    rest = rest.slice(73)
  }
  return parts.join('\r\n')
}

function buildIcs(ctx) {
  const { booking, room, meeting } = ctx
  const start = new Date(booking.startsAt)
  const end = new Date(start.getTime() + booking.duration * 60_000)
  const location = [room.name, meeting.venue, meeting.city].filter(Boolean).join(', ')

  // Effective link: the booking's custom link, or the room's current default.
  const videoUrl = booking.videoLinkUrl || room.videoLinkUrl

  const descParts = []
  if (booking.description) descParts.push(booking.description)
  if (videoUrl) descParts.push(`${room.videoLinkName || 'Video'}: ${videoUrl}`)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IETF Side Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@sidemeetings.ietf.org`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(booking.title)}`,
    ...(descParts.length ? [`DESCRIPTION:${icsEscape(descParts.join('\n'))}`] : []),
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    ...(videoUrl ? [`URL:${icsEscape(videoUrl)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  return lines.map(icsFold).join('\r\n')
}

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function adminBookingUrl(bookingId) {
  return `${frontendBase()}/admin/bookings/${bookingId}`
}

// The organizer's own list of side meetings, where they can edit a description
// or cancel a request.
function manageUrl() {
  return `${frontendBase()}/manage`
}

const MANAGE_LABEL = 'Manage my side meetings'

// ─── Public API ───────────────────────────────────────────────────────────────
//
// Each function is fire-and-forget friendly: it resolves the shared mail
// settings, never throws, and returns a boolean indicating whether a message
// was actually dispatched. `ctx` is the object returned by loadBookingContext():
//   { booking, organizer, room, meeting }

// 1) Organizer: request received, pending review.
export async function sendBookingPending(ctx, logger = console) {
  const { from, replyTo, emailEnabled } = await getMailSettings()
  const heading = 'Your side meeting request was received'
  const introHtml =
    'Thanks for your request. It is now <strong>pending review</strong> by the IETF Secretariat. ' +
    'You will receive another email once it has been approved or rejected.'
  const introText =
    'Thanks for your request. It is now pending review by the IETF Secretariat. ' +
    'You will receive another email once it has been approved or rejected.'

  return send(
    {
      from,
      replyTo,
      to: ctx.organizer.email,
      subject: `Side meeting request received: ${ctx.booking.title}`,
      html: layout({
        heading,
        intro: introHtml,
        ctx,
        buttonUrl: manageUrl(),
        buttonLabel: MANAGE_LABEL,
        footer: SUPPORT_FOOTER_HTML
      }),
      text: plainText({
        heading,
        introText,
        ctx,
        buttonUrl: manageUrl(),
        footerText: SUPPORT_FOOTER_TEXT
      }),
      enabled: emailEnabled
    },
    logger
  )
}

// 2) Approvers: a new submission needs review.
export async function sendApproverNotification(ctx, logger = console) {
  const { from, replyTo, approvers, emailEnabled } = await getMailSettings()
  if (!emailEnabled) {
    logger.info?.('[email] notifications disabled — skipping approver notification')
    return false
  }
  if (!approvers.length) {
    logger.warn?.('[email] no approvers configured — skipping approver notification')
    return false
  }

  const url = adminBookingUrl(ctx.booking.id)
  const heading = 'New side meeting request to review'
  const introHtml =
    `A new side meeting request has been submitted by <strong>${esc(ctx.organizer.name)}</strong> ` +
    'and is awaiting review.'
  const introText = `A new side meeting request has been submitted by ${ctx.organizer.name} and is awaiting review.`

  return send(
    {
      from,
      replyTo,
      to: approvers,
      subject: `New side meeting request: ${ctx.booking.title}`,
      html: layout({
        heading,
        intro: introHtml,
        ctx,
        includePeople: true,
        videoMode: 'requested',
        buttonUrl: url,
        buttonLabel: 'Review this request'
      }),
      text: plainText({
        heading,
        introText,
        ctx,
        includePeople: true,
        videoMode: 'requested',
        buttonUrl: url
      }),
      enabled: emailEnabled
    },
    logger
  )
}

// 3) Organizer + co-organizers: approved, with an .ics attachment.
export async function sendBookingApproved(ctx, logger = console) {
  const { from, replyTo, emailEnabled } = await getMailSettings()
  const coEmails = (Array.isArray(ctx.booking.coOrganizers) ? ctx.booking.coOrganizers : [])
    .map((c) => c.email)
    .filter(Boolean)
  const recipients = [ctx.organizer.email, ...coEmails].filter(Boolean)

  const heading = 'Your side meeting has been approved'
  const introHtml =
    'Good news — your side meeting request has been <strong>approved</strong>. ' +
    'The details are below, and a calendar invite (.ics) is attached so you can add it to your calendar.'
  const introText =
    'Good news — your side meeting request has been approved. ' +
    'A calendar invite (.ics) is attached so you can add it to your calendar.'

  return send(
    {
      from,
      replyTo,
      to: recipients,
      subject: `Side meeting approved: ${ctx.booking.title}`,
      html: layout({
        heading,
        intro: introHtml,
        ctx,
        videoMode: 'effective',
        buttonUrl: manageUrl(),
        buttonLabel: MANAGE_LABEL,
        footer: SUPPORT_FOOTER_HTML
      }),
      text: plainText({
        heading,
        introText,
        ctx,
        videoMode: 'effective',
        buttonUrl: manageUrl(),
        footerText: SUPPORT_FOOTER_TEXT
      }),
      attachments: [
        {
          filename: 'side-meeting.ics',
          content: buildIcs(ctx),
          contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
        }
      ],
      enabled: emailEnabled
    },
    logger
  )
}

// 4) Organizer only: rejected.
export async function sendBookingRejected(ctx, logger = console) {
  const { from, replyTo, emailEnabled } = await getMailSettings()
  const heading = 'Your side meeting request was declined'
  const introHtml = 'Unfortunately, your side meeting request was <strong>not approved</strong>.'
  const introText = 'Unfortunately, your side meeting request was not approved.'
  const footer = SUPPORT_FOOTER_HTML
  const footerText = SUPPORT_FOOTER_TEXT

  return send(
    {
      from,
      replyTo,
      to: ctx.organizer.email,
      subject: `Side meeting request declined: ${ctx.booking.title}`,
      html: layout({
        heading,
        intro: introHtml,
        ctx,
        buttonUrl: manageUrl(),
        buttonLabel: MANAGE_LABEL,
        footer
      }),
      text: plainText({ heading, introText, ctx, buttonUrl: manageUrl(), footerText }),
      enabled: emailEnabled
    },
    logger
  )
}

// 5) Approvers: the organizer proposed a new description for an existing
// booking. The live description (shown in the details below) stays published
// until an approver accepts the change.
export async function sendDescriptionChangeNotification(ctx, logger = console) {
  const { from, replyTo, approvers, emailEnabled } = await getMailSettings()
  if (!emailEnabled) {
    logger.info?.('[email] notifications disabled — skipping description change notification')
    return false
  }
  if (!approvers.length) {
    logger.warn?.('[email] no approvers configured — skipping description change notification')
    return false
  }

  const url = adminBookingUrl(ctx.booking.id)
  const heading = 'Description change to review'
  const introHtml =
    `<strong>${esc(ctx.organizer.name)}</strong> requested a new description for their side ` +
    'meeting. The current description below stays published until you approve the change.'
  const introText =
    `${ctx.organizer.name} requested a new description for their side meeting. The current ` +
    'description below stays published until you approve the change.'
  const extraRows = [['Proposed description', ctx.booking.pendingDescription || '']]

  return send(
    {
      from,
      replyTo,
      to: approvers,
      subject: `Description change to review: ${ctx.booking.title}`,
      html: layout({
        heading,
        intro: introHtml,
        ctx,
        extraRows,
        buttonUrl: url,
        buttonLabel: 'Review this change'
      }),
      text: plainText({ heading, introText, ctx, extraRows, buttonUrl: url }),
      enabled: emailEnabled
    },
    logger
  )
}
