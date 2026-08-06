<template>
  <!-- Top bar -->
  <header class="w-full max-w-[1100px] flex items-center justify-between gap-4 pt-6 pb-2 flex-wrap">
    <NuxtLink to="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
      <img
        src="https://static.ietf.org/logos/ietf-square-inverted.svg"
        alt="IETF"
        class="w-[34px] h-[34px] flex-shrink-0" />
      <div>
        <div class="font-bold text-sm text-text leading-tight">Side Meetings</div>
        <div class="text-[11px] text-text-faint font-medium">Schedule</div>
      </div>
    </NuxtLink>
    <NuxtLink v-if="canRequest" to="/request" class="btn-primary"
      ><Plus class="w-4 h-4" /> Request a side meeting</NuxtLink
    >
    <div v-else class="relative group cursor-not-allowed">
      <button class="btn-primary opacity-50 pointer-events-none" disabled>
        <Plus class="w-4 h-4" /> Request a side meeting
      </button>
      <span
        class="pointer-events-none absolute right-0 top-full mt-2 px-3 py-2 rounded-lg bg-s3 border border-border-strong text-text text-xs font-medium text-center max-w-[240px] w-max opacity-0 group-hover:opacity-100 transition-opacity shadow-card z-40">
        {{ requestDisabledReason }}
      </span>
    </div>
  </header>

  <div class="w-full max-w-[1100px] flex-1">
    <div v-if="loading" class="py-20 text-center text-text-dim">Loading…</div>
    <div v-else-if="!meeting" class="py-20 text-center text-text-dim">
      No active meeting at the moment. Please check back later.
    </div>

    <template v-else>
      <!-- Meeting heading -->
      <div class="flex items-start justify-between gap-4 flex-wrap mt-4 mb-5">
        <div>
          <div class="relative inline-block">
            <div class="flex items-center gap-2">
              <h1 class="text-[26px] font-extrabold text-text tracking-tight">
                {{ meetingLabel(meeting.num) }} · {{ meeting.city }}, {{ meeting.country }}
              </h1>
              <div v-if="selectableMeetings.length > 1" class="relative group flex-shrink-0">
                <button
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text bg-surface hover:bg-s2 border border-border transition-colors"
                  @click="pickerOpen = !pickerOpen">
                  <ChevronDown class="w-4 h-4" :class="pickerOpen ? 'rotate-180' : ''" />
                </button>
                <span
                  v-if="!pickerOpen"
                  class="pointer-events-none absolute right-0 top-full mt-2 px-3 py-2 rounded-lg bg-s3 border border-border-strong text-text text-xs font-medium text-center max-w-[240px] w-max opacity-0 group-hover:opacity-100 transition-opacity shadow-card z-40">
                  View another meeting
                </span>
              </div>
            </div>

            <!-- Meeting picker dropdown -->
            <template v-if="pickerOpen">
              <div class="fixed inset-0 z-30" @click="pickerOpen = false"></div>
              <div
                class="absolute right-0 top-full mt-1 z-40 w-[320px] max-w-[88vw] bg-surface border border-border rounded-xl shadow-card p-1.5 max-h-[60vh] overflow-y-auto">
                <button
                  v-for="m in selectableMeetings"
                  :key="m.id"
                  class="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors"
                  :class="m.id === meeting.id ? 'bg-s2' : 'hover:bg-s2'"
                  @click="selectMeeting(m)">
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-text truncate">
                      {{ meetingLabel(m.num) }} · {{ m.city }}, {{ m.country }}
                    </div>
                    <div class="text-xs text-text-dim">
                      {{ formatDateRange(m.startDate, m.endDate) }}
                    </div>
                  </div>
                  <span
                    v-if="m.isActive"
                    class="flex-shrink-0 text-[10px] font-bold text-accent bg-accent-weak px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                </button>
              </div>
            </template>
          </div>
          <div class="text-base text-text-dim mt-1">
            {{ formatDateRange(meeting.startDate, meeting.endDate) }}
          </div>

          <!-- Room selector -->
          <div class="flex flex-wrap items-center gap-2 mt-4">
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              :class="
                allSelected
                  ? 'bg-accent-weak text-accent border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="selectAllRooms">
              All rooms
            </button>
            <button
              v-for="room in rooms"
              :key="room.id"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              :class="
                selectedRoomId === room.id
                  ? 'bg-accent-weak text-accent border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="toggleRoom(room.id)">
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: roomColorHex(room.color) }"></span>
              {{ room.name }}
            </button>
          </div>
        </div>

        <!-- Timezone selector -->
        <div class="flex flex-col items-stretch sm:items-end gap-1.5 w-full sm:w-auto">
          <div class="text-[11px] font-semibold text-text-dim uppercase tracking-wide px-1">
            Timezone
          </div>
          <div
            class="bg-surface border border-border rounded-xl p-2 flex flex-col gap-2 w-full sm:w-[260px]">
            <div class="flex items-center gap-1">
              <button
                v-for="opt in tzOptions"
                :key="opt.key"
                class="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                :class="
                  tzMode === opt.key
                    ? 'bg-accent text-accent-text'
                    : 'text-text-dim hover:text-text'
                "
                @click="tzMode = opt.key">
                {{ opt.label }}
              </button>
            </div>
            <select class="form-input !text-xs !py-1.5" :value="activeTz" @change="onTzSelect">
              <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Schedule -->
      <div class="card overflow-hidden !rounded-2xl">
        <PublicScheduleGrid
          :meeting="meeting"
          :bookings="visibleBookings"
          :timezone="activeTz"
          :room-color-map="roomColorMap"
          @booking-click="openBooking"
          @calendar-click="addToCalendar" />
      </div>

      <!-- Subscribe to calendar -->
      <div class="flex flex-col sm:flex-row items-stretch justify-center gap-6 mt-10">
        <!-- Left: subscribe -->
        <div
          class="flex flex-col items-center sm:items-end gap-2 text-center sm:text-right sm:flex-1 min-w-0">
          <span class="text-xs text-text-dim">
            Subscribe to keep this schedule in sync as meetings are added or updated:
          </span>
          <a :href="webcalUrl" class="btn" style="background: #38bdf8; color: #052338">
            <CalendarPlus class="w-4 h-4" /> Subscribe to calendar
          </a>
        </div>

        <!-- Separator -->
        <div class="hidden sm:block w-px bg-border self-stretch"></div>

        <!-- Right: copy feed URL -->
        <div
          class="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left sm:flex-1 min-w-0">
          <span class="text-xs text-text-dim">or copy the feed url:</span>
          <button
            class="text-[11px] font-mono text-text-dim hover:text-text break-all max-w-full px-3 py-1.5 rounded-lg bg-surface border border-border transition-colors"
            title="Copy calendar URL"
            @click="copyCalendarUrl">
            {{ copied ? 'Copied!' : calendarUrl }}
          </button>
        </div>
      </div>
    </template>
  </div>

  <!-- Footer -->
  <footer class="self-stretch -mx-6 -mb-20 mt-16 bg-sidebar-bg border-t border-border">
    <div
      class="max-w-[1100px] mx-auto px-6 py-6 flex flex-col sm:grid sm:grid-cols-3 items-center gap-4">
      <div class="flex items-center gap-3 sm:justify-self-start">
        <a
          href="mailto:support@ietf.org"
          class="text-xs text-text-dim hover:text-text transition-colors">
          Support
        </a>
        <span class="w-px h-3.5 bg-border-strong"></span>
        <a
          href="https://status.ietf.org"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          System status
        </a>
        <span class="w-px h-3.5 bg-border-strong"></span>
        <a
          :href="apiDocsUrl"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          API
        </a>
        <span class="w-px h-3.5 bg-border-strong"></span>
        <a
          href="https://github.com/ietf-tools/sidemeetings/issues"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          Report a bug
        </a>
      </div>
      <span class="text-xs text-text-faint sm:justify-self-center">Version {{ appVersion }}</span>
      <div class="flex items-center gap-3 sm:justify-self-end">
        <a
          href="https://www.ietf.org"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          IETF
        </a>
        <span class="w-px h-3.5 bg-border-strong"></span>
        <a
          href="https://datatracker.ietf.org"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          Datatracker
        </a>
        <span class="w-px h-3.5 bg-border-strong"></span>
        <a
          href="https://www.rfc-editor.org"
          target="_blank"
          rel="noopener"
          class="text-xs text-text-dim hover:text-text transition-colors">
          RFC Editor
        </a>
      </div>
    </div>
  </footer>

  <!-- Booking detail modal -->
  <AdminModal
    v-model="modalOpen"
    :title="active?.title || 'Side meeting'"
    size="md"
    :close-on-overlay="true">
    <div v-if="active" class="px-6 py-5 flex flex-col gap-4">
      <div class="flex items-center gap-2 text-sm">
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :style="{ background: roomColorMap[active.roomId] || '#2dd4bf' }"></span>
        <span class="font-semibold text-text">{{ active.roomName }}</span>
        <span
          v-if="active.isIrtf"
          class="ml-1 text-[10.5px] font-bold px-2 py-px rounded-full bg-accent-weak text-accent">
          IRTF
        </span>
      </div>

      <div>
        <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">When</p>
        <div class="text-sm font-semibold text-text mt-0.5">{{ activeWhen.day }}</div>
        <div class="mt-0.5 flex items-baseline gap-2 flex-wrap font-mono">
          <span class="text-xl font-bold text-white">{{ activeWhen.range }}</span>
          <span class="text-xs text-text-dim">({{ activeTz }})</span>
        </div>
      </div>

      <div v-if="active.description">
        <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Description</p>
        <p class="text-sm text-white mt-1 leading-relaxed whitespace-pre-line">
          {{ active.description }}
        </p>
      </div>

      <div v-if="active.areas?.length && !active.isIrtf">
        <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Areas</p>
        <div class="flex flex-wrap gap-1.5 mt-1.5">
          <span
            v-for="a in active.areas"
            :key="a"
            class="text-xs font-semibold px-2 py-0.5 rounded-md text-accent bg-accent-weak border border-accent/30">
            {{ a }}
          </span>
        </div>
      </div>

      <div>
        <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Organizers</p>
        <div class="text-sm text-text mt-1">
          {{ active.organizerName }}
          <span v-if="active.organizerEmail" class="text-text-dim font-mono text-xs ml-1">{{
            active.organizerEmail
          }}</span>
        </div>
        <div
          v-for="co in active.coOrganizers || []"
          :key="co.email || co.name"
          class="text-sm text-text mt-0.5">
          {{ co.name }}
          <span v-if="co.email" class="text-text-dim font-mono text-xs ml-1">{{ co.email }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-center gap-2 px-6 py-4 border-t border-border">
        <button class="btn-secondary justify-center" @click="modalOpen = false">
          <X class="w-4 h-4" /> Close
        </button>
        <button
          class="btn justify-center"
          style="background: #38bdf8; color: #052338"
          @click="addToCalendar(active)">
          <CalendarPlus class="w-4 h-4" /> Add to calendar
        </button>
        <a
          v-if="joinUrl(active)"
          :href="joinUrl(active)"
          target="_blank"
          rel="noopener"
          class="btn-primary justify-center">
          <Video class="w-4 h-4" /> Join Meeting Call
        </a>
        <button v-else class="btn-secondary justify-center opacity-50 cursor-not-allowed" disabled>
          <Video class="w-4 h-4" /> Link not available
        </button>
      </div>
    </template>
  </AdminModal>
</template>

<script setup lang="ts">
import { Plus, Video, CalendarPlus, ChevronDown, X } from 'lucide-vue-next'

definePageMeta({ layout: 'request' })

const { formatDateRange, minutesToTime } = useTemporal()
const config = useRuntimeConfig()
const appVersion = config.public.appVersion

// Public iCalendar subscription feed for the active meeting, e.g.
// https://host/calendar/126.ics (served by the backend at its root).
const calendarUrl = computed(() => {
  if (!meeting.value) return ''
  let base = (config.public.apiUrl as string) || ''
  base = base.replace(/\/api\/?$/, '') // backend origin (strip the /api suffix)
  if (!/^https?:\/\//.test(base)) {
    base = (import.meta.client ? window.location.origin : '') + base
  }
  return `${base}/calendar/${meeting.value.num}.ics`
})
// webcal:// scheme prompts most calendar apps to subscribe (auto-refreshing).
const webcalUrl = computed(() => calendarUrl.value.replace(/^https?:/, 'webcal:'))

// Public API docs (Swagger UI), served by the backend at <apiUrl>/docs. apiUrl
// always ends in /api, so this resolves to /api/docs in the integrated build and
// the absolute backend URL in dev.
const apiDocsUrl = computed(() => {
  const base = (config.public.apiUrl as string) || '/api'
  return `${base.replace(/\/$/, '')}/docs`
})

const copied = ref(false)
async function copyCalendarUrl() {
  try {
    await navigator.clipboard.writeText(calendarUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // clipboard unavailable — ignore
  }
}

const ROOM_COLORS: Record<string, string> = {
  sky: '#38bdf8',
  yellow: '#fbbf24',
  purple: '#a78bfa',
  emerald: '#34d399',
  indigo: '#818cf8'
}
function roomColorHex(name?: string) {
  return name ? ROOM_COLORS[name] || '#2dd4bf' : '#2dd4bf'
}

const loading = ref(true)
const meeting = ref<any>(null)
const rooms = ref<any[]>([])
const bookings = ref<any[]>([])

// ── Meeting picker (view past meetings) ─────────────────────────────────────
const meetingList = ref<any[]>([])
const pickerOpen = ref(false)

// Whether side-meeting requests can be submitted right now, with a reason when
// not: only for the active meeting, only between the submission open date and
// the end of the meeting.
const requestDisabledReason = computed(() => {
  const m = meeting.value
  if (!m) return 'No active meeting'
  if (!m.isActive) return 'Requests are only open for the current meeting'
  try {
    const now = Temporal.Now.instant()
    if (!m.allowRequestsFrom) return 'Side meeting requests are not open yet'
    if (Temporal.Instant.compare(now, Temporal.Instant.from(m.allowRequestsFrom)) < 0) {
      return "Side meeting requests haven't opened yet"
    }
    const endInstant = Temporal.PlainDate.from(m.endDate)
      .toZonedDateTime({
        timeZone: m.timezone || 'UTC',
        plainTime: Temporal.PlainTime.from('23:59:59')
      })
      .toInstant()
    if (Temporal.Instant.compare(now, endInstant) > 0) return 'This meeting has ended'
  } catch {
    return 'Side meeting requests are not open'
  }
  return ''
})
const canRequest = computed(() => !requestDisabledReason.value)

// All meetings are offered in the picker (most recent first, as returned by the API).
const selectableMeetings = computed(() => meetingList.value)

async function loadSchedule(meetingId?: string) {
  loading.value = true
  try {
    const q = meetingId ? `?meetingId=${meetingId}` : ''
    const data = await useApiFetch<{ meeting: any; rooms: any[]; bookings: any[] }>(
      `/public/schedule${q}`
    )
    meeting.value = data.meeting
    rooms.value = data.rooms
    bookings.value = data.bookings
    selectedRoomId.value = null
  } catch {
    // no meeting / failed to load
  } finally {
    loading.value = false
  }
}

function selectMeeting(m: any) {
  pickerOpen.value = false
  if (m.id !== meeting.value?.id) loadSchedule(m.id)
}

// null = "All rooms"; otherwise a single focused room id.
const selectedRoomId = ref<string | null>(null)
const allSelected = computed(() => selectedRoomId.value === null)

const roomColorMap = computed<Record<string, string>>(() =>
  Object.fromEntries(rooms.value.map((r) => [r.id, roomColorHex(r.color)]))
)

const visibleBookings = computed(() =>
  selectedRoomId.value === null
    ? bookings.value
    : bookings.value.filter((b) => b.roomId === selectedRoomId.value)
)

// ── Timezone selection ──────────────────────────────────────────────────────
const tzMode = ref<'meeting' | 'local' | 'utc' | 'custom'>('meeting')
const customTz = ref('UTC')
const localTz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
})()
const tzOptions = [
  { key: 'meeting' as const, label: 'Meeting time' },
  { key: 'local' as const, label: 'My time' },
  { key: 'utc' as const, label: 'UTC' }
]
const activeTz = computed(() => {
  if (tzMode.value === 'custom') return customTz.value
  if (tzMode.value === 'local') return localTz
  if (tzMode.value === 'utc') return 'UTC'
  return meeting.value?.timezone || 'UTC'
})

// Picking from the full dropdown switches to a custom timezone.
function onTzSelect(e: Event) {
  customTz.value = (e.target as HTMLSelectElement).value
  tzMode.value = 'custom'
}

// Full IANA timezone list from the runtime, falling back to a short list.
const TIMEZONES = (() => {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone')
      return zones.includes('UTC') ? zones : ['UTC', ...zones]
    }
  } catch {
    // ignore and fall through
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ]
})()

// ── Room filter ─────────────────────────────────────────────────────────────
function selectAllRooms() {
  selectedRoomId.value = null
}
function toggleRoom(id: string) {
  // Single-select: focus this room, or return to "All rooms" if it was already focused.
  selectedRoomId.value = selectedRoomId.value === id ? null : id
}

// ── Booking modal ───────────────────────────────────────────────────────────
const active = ref<any>(null)
const modalOpen = ref(false)

function openBooking(booking: any) {
  active.value = booking
  modalOpen.value = true
}

const activeWhen = computed(() => {
  if (!active.value) return { day: '', range: '' }
  try {
    const zdt = Temporal.Instant.from(active.value.startsAt).toZonedDateTimeISO(activeTz.value)
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]
    const startMin = zdt.hour * 60 + zdt.minute
    return {
      day: `${weekdays[zdt.dayOfWeek - 1]}, ${months[zdt.month - 1]} ${zdt.day}, ${zdt.year}`,
      range: `${minutesToTime(startMin)}–${minutesToTime(startMin + active.value.duration)}`
    }
  } catch {
    return { day: '', range: '' }
  }
})

function joinUrl(booking: any): string {
  return booking?.videoLinkUrl || ''
}

// ── Add to calendar (.ics download) ─────────────────────────────────────────
function pad(n: number) {
  return String(n).padStart(2, '0')
}
function icsStamp(instantStr: string) {
  const z = Temporal.Instant.from(instantStr).toZonedDateTimeISO('UTC')
  return `${z.year}${pad(z.month)}${pad(z.day)}T${pad(z.hour)}${pad(z.minute)}${pad(z.second)}Z`
}
function escapeIcs(s: string) {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}
function addToCalendar(booking: any) {
  if (!booking) return
  const start = icsStamp(booking.startsAt)
  const endInstant = Temporal.Instant.from(booking.startsAt)
    .add({ minutes: booking.duration })
    .toString()
  const end = icsStamp(endInstant)
  const url = joinUrl(booking)
  const desc = (booking.description || '') + (url ? `\n\nJoin: ${url}` : '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IETF Side Meetings//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@sidemeetings.ietf.org`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(booking.title)}`,
    `LOCATION:${escapeIcs(booking.roomName)}`,
    `DESCRIPTION:${escapeIcs(desc)}`,
    url ? `URL:${escapeIcs(url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = `${(booking.title || 'side-meeting').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

onMounted(async () => {
  // Meeting list for the picker (non-blocking).
  useApiFetch<any[]>('/public/meetings')
    .then((list) => {
      meetingList.value = list
    })
    .catch(() => {})
  // Active meeting schedule.
  await loadSchedule()
})
</script>
