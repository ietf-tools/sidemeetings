<template>
  <div class="max-w-[1000px] mx-auto">
    <div class="flex justify-end mb-6">
      <button class="btn-primary" @click="openAdd"><Plus class="w-4 h-4" /> Add meeting</button>
    </div>

    <div v-if="loading" class="py-16 text-center text-text-dim">Loading…</div>
    <div v-else class="space-y-3">
      <div
        v-for="m in sortedMeetings"
        :key="m.id"
        class="card p-5 transition-all"
        :class="m.isActive ? 'border-accent/50' : ''"
        :style="
          m.isActive
            ? 'box-shadow: inset 0 0 0 1px rgba(45,212,191,.5), inset 0 0 26px rgba(45,212,191,.22), var(--shadow);'
            : ''
        ">
        <div class="flex items-center gap-4">
          <!-- Num badge -->
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.2)">
            <span class="text-accent text-lg font-bold">{{ m.num }}</span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap gap-2.5">
              <div class="text-base font-bold text-text">
                {{ meetingLabel(m.num) }} · {{ m.city }}
              </div>
              <span
                class="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full"
                :style="`color:${statusColor(m)}; background:color-mix(in srgb, ${statusColor(m)} 14%, transparent);`">
                {{ statusLabel(m) }}
              </span>
              <span
                v-if="meetingStore.viewingMeeting?.id === m.id"
                class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-accent bg-accent-weak">
                Viewing
              </span>
            </div>

            <div class="text-[12.5px] text-text-dim mt-1">
              {{ formatDateRange(m.startDate, m.endDate) }} · {{ m.venue }}
            </div>

            <div class="flex items-center gap-1.5 text-xs text-text-faint mt-1">
              <Clock class="w-3 h-3" />
              <span class="font-mono">{{ m.timezone }}</span>
            </div>

            <div class="flex flex-col items-start gap-1.5 mt-1.5">
              <span class="inline-flex items-center gap-1.5 text-xs text-text-dim">
                <Calendar class="w-3 h-3" />
                Submissions open
                <b class="font-mono font-semibold text-text">{{ subOpenLabel(m) }}</b>
              </span>
              <span
                class="text-[10.5px] font-bold px-2 py-px rounded-full"
                :style="`color:${subStatusColor(m)}; background:color-mix(in srgb, ${subStatusColor(m)} 14%, transparent);`">
                {{ subStatusLabel(m) }}
              </span>
            </div>
          </div>

          <!-- Counts -->
          <div class="text-center flex-shrink-0">
            <div class="text-xl font-extrabold text-text">{{ m.roomCount ?? 0 }}</div>
            <div class="text-xs text-text-faint">rooms</div>
          </div>
          <div class="text-center flex-shrink-0">
            <div class="text-xl font-extrabold text-text">{{ m.bookingCount ?? 0 }}</div>
            <div class="text-xs text-text-faint">bookings</div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              class="btn-secondary text-xs h-8 px-3 justify-center gap-1.5"
              :class="
                meetingStore.viewingMeeting?.id === m.id
                  ? '!border-accent !bg-accent-weak !text-accent shadow-room-selected cursor-default'
                  : ''
              "
              @click="meetingStore.setViewingMeeting(m)">
              <Eye class="w-3.5 h-3.5" />
              {{ meetingStore.viewingMeeting?.id === m.id ? 'Viewing' : 'View' }}
            </button>
            <button
              class="btn-secondary text-xs h-8 px-3 justify-center"
              :class="
                m.isActive
                  ? '!border-accent !bg-accent-weak !text-accent shadow-room-selected cursor-default'
                  : ''
              "
              @click="!m.isActive && setActive(m.id)">
              {{ m.isActive ? 'Active' : 'Set active' }}
            </button>
            <button class="btn-secondary text-xs h-8 px-3 justify-center" @click="openEdit(m)">
              <Pencil class="w-3 h-3" /> Edit
            </button>
            <button
            class="btn-secondary text-xs h-8 px-3 justify-center !border-bad !text-bad hover:!bg-bad/10"
            @click="confirmDel = m">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <AdminModal v-model="modalOpen" :title="editing ? 'Edit meeting' : 'Add meeting'" size="lg">
      <div class="space-y-4 px-6 py-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Meeting number *</label>
            <input v-model="form.num" type="text" class="form-input" placeholder="e.g. 126" />
            <div v-if="form.num" class="text-[11.5px] text-text-faint mt-1.5">
              Displayed as
              <span class="text-text-dim font-semibold">{{ meetingLabel(form.num) }}</span>
            </div>
          </div>
          <div>
            <label class="form-label">Timezone *</label>
            <select v-model="form.timezone" class="form-input">
              <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">City *</label>
            <input v-model="form.city" type="text" class="form-input" />
          </div>
          <div>
            <label class="form-label">Country *</label>
            <input v-model="form.country" type="text" class="form-input" />
          </div>
        </div>
        <div>
          <label class="form-label">Venue</label>
          <input v-model="form.venue" type="text" class="form-input" placeholder="Hotel name" />
        </div>
        <div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Start date (YYYY-MM-DD) *</label>
              <input
                v-model="form.startDate"
                type="text"
                class="form-input font-mono"
                placeholder="e.g. 2026-07-20" />
            </div>
            <div>
              <label class="form-label">End date (YYYY-MM-DD) *</label>
              <input
                v-model="form.endDate"
                type="text"
                class="form-input font-mono"
                placeholder="e.g. 2026-07-24" />
            </div>
          </div>
          <div v-if="datePreview" class="text-xs text-text-faint mt-1.5">
            Displayed as <span class="text-text-dim font-semibold">{{ datePreview }}</span>
          </div>
        </div>
        <div>
          <label class="form-label">
            Submissions open
            <span class="text-text-faint font-normal">· when organizers can start requesting</span>
          </label>
          <div class="flex items-center gap-2.5">
            <input
              v-model="form.subOpenDate"
              type="text"
              inputmode="numeric"
              maxlength="10"
              placeholder="YYYY-MM-DD"
              class="form-input font-mono flex-1 min-w-0" />
            <span class="text-sm text-text-dim flex-shrink-0">at</span>
            <input
              v-model="form.subOpenTime"
              type="text"
              inputmode="numeric"
              maxlength="5"
              placeholder="HH:MM"
              class="form-input font-mono w-24 flex-shrink-0" />
          </div>
          <div class="text-[11.5px] text-text-faint mt-1.5">In the meeting's time zone.</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Inter-meeting buffer</label>
            <div class="relative flex items-center">
              <input
                v-model.number="form.buffer"
                type="text"
                inputmode="numeric"
                class="form-input font-mono pr-11"
                :class="bufferError ? '!border-bad' : ''" />
              <span class="absolute right-3 text-xs text-text-faint pointer-events-none">min</span>
            </div>
            <div v-if="bufferError" class="text-[11.5px] text-bad mt-1.5">
              {{ bufferError }}
            </div>
            <div v-else class="text-[11.5px] text-text-faint mt-1.5">
              Gap required between back-to-back side meetings.
            </div>
          </div>
          <div>
            <label class="form-label">Minimum notice</label>
            <div class="relative flex items-center">
              <input
                v-model.number="form.minNotice"
                type="text"
                inputmode="numeric"
                class="form-input font-mono pr-11" />
              <span class="absolute right-3 text-xs text-text-faint pointer-events-none">min</span>
            </div>
            <div class="text-[11.5px] text-text-faint mt-1.5">
              How far ahead of the slot a request must be made.
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button class="btn-secondary" @click="modalOpen = false">Cancel</button>
          <button class="btn-primary" :disabled="saving || !!bufferError" @click="save">
            {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Add meeting' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- Delete confirm -->
    <AdminDeleteConfirm
      v-if="confirmDel"
      v-model="confirmDelOpen"
      title="Delete meeting"
      :message="`Delete ${meetingLabel(confirmDel?.num)}? This will also delete all associated rooms and bookings. This cannot be undone.`"
      confirm-text="Delete meeting"
      @confirm="deleteMeeting"
      @cancel="confirmDel = null" />
  </div>
</template>

<script setup lang="ts">
import { Plus, Pencil, Trash2, Clock, Calendar, Eye } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Meetings'
pageSubtitle.value = 'Manage IETF meetings'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const { formatDateRange, submissionsStatus, formatSubmittedAt } = useTemporal()

const loading = ref(true)
const saving = ref(false)
const modalOpen = ref(false)
const editing = ref<any>(null)
const confirmDel = ref<any>(null)
const confirmDelOpen = computed({
  get: () => !!confirmDel.value,
  set: (v) => {
    if (!v) confirmDel.value = null
  }
})

const form = reactive({
  num: '',
  city: '',
  country: '',
  venue: '',
  startDate: '',
  endDate: '',
  timezone: 'UTC',
  subOpenDate: '',
  subOpenTime: '09:00',
  buffer: 15,
  minNotice: 120
})

// The inter-meeting buffer must be a non-negative multiple of 15 minutes
// (0 is allowed) so it lines up with the 15-min booking granularity.
const bufferError = computed(() => {
  const v = form.buffer
  if (v === null || (v as any) === '' || typeof v !== 'number' || Number.isNaN(v)) {
    return 'Enter a number of minutes.'
  }
  if (!Number.isInteger(v) || v < 0) return 'Must be 0 or a positive whole number.'
  if (v % 15 !== 0) return 'Must be in 15-minute increments (0, 15, 30, …).'
  return ''
})

// Human-readable preview of the entered start/end dates, e.g. "July 20–24, 2026".
const datePreview = computed(() => {
  if (!form.startDate || !form.endDate) return ''
  try {
    return formatDateRange(form.startDate, form.endDate)
  } catch {
    return ''
  }
})

// Full IANA timezone list from the runtime, falling back to a short list on
// older browsers that lack Intl.supportedValuesOf.
const TIMEZONES = (() => {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone')
      return zones.includes('UTC') ? zones : ['UTC', ...zones]
    }
  } catch {
    // ignore and fall through to the static list
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland'
  ]
})()

const sortedMeetings = computed(() =>
  [...meetingStore.meetings].sort((a, b) => Number(b.num) - Number(a.num))
)

function isPast(m: any) {
  try {
    const end = Temporal.PlainDate.from(m.endDate)
    const today = Temporal.Now.plainDateISO()
    return Temporal.PlainDate.compare(end, today) < 0
  } catch {
    return false
  }
}

function statusLabel(m: any) {
  if (m.isActive) return 'Active'
  if (isPast(m)) return 'Past'
  return 'Planning'
}

function statusColor(m: any) {
  if (m.isActive) return 'var(--ok)'
  if (isPast(m)) return 'var(--muted)'
  return 'var(--accent)'
}

function subStatusLabel(m: any) {
  const s = submissionsStatus(m)
  if (s === 'not-open') return 'Submissions not yet open'
  if (s === 'open') return 'Submissions open'
  return 'Submissions closed'
}

function subStatusColor(m: any) {
  const s = submissionsStatus(m)
  if (s === 'open') return 'var(--ok)'
  if (s === 'not-open') return 'var(--warn)'
  return 'var(--muted)'
}

function subOpenLabel(m: any) {
  if (!m.allowRequestsFrom) return 'Not set'
  return formatSubmittedAt(m.allowRequestsFrom, m.timezone)
}

function openAdd() {
  editing.value = null
  Object.assign(form, {
    num: '',
    city: '',
    country: '',
    venue: '',
    startDate: '',
    endDate: '',
    timezone: 'UTC',
    subOpenDate: '',
    subOpenTime: '09:00',
    buffer: 15,
    minNotice: 120
  })
  modalOpen.value = true
}

function openEdit(m: any) {
  editing.value = m
  // Split the stored allowRequestsFrom instant into a date + time in the
  // meeting's own time zone for editing.
  let subOpenDate = ''
  let subOpenTime = '09:00'
  if (m.allowRequestsFrom) {
    try {
      const zdt = Temporal.Instant.from(m.allowRequestsFrom).toZonedDateTimeISO(m.timezone || 'UTC')
      subOpenDate = `${zdt.year}-${String(zdt.month).padStart(2, '0')}-${String(zdt.day).padStart(2, '0')}`
      subOpenTime = `${String(zdt.hour).padStart(2, '0')}:${String(zdt.minute).padStart(2, '0')}`
    } catch {
      // leave defaults
    }
  }
  Object.assign(form, {
    num: m.num,
    city: m.city,
    country: m.country,
    venue: m.venue || '',
    startDate: m.startDate,
    endDate: m.endDate,
    timezone: m.timezone,
    subOpenDate,
    subOpenTime,
    buffer: m.buffer ?? 15,
    minNotice: m.minNotice ?? 120
  })
  modalOpen.value = true
}

async function save() {
  if (bufferError.value) {
    toast.show(bufferError.value, 'bad')
    return
  }
  saving.value = true
  try {
    // Combine the date + time (entered in the meeting's time zone) into an
    // absolute instant for the API.
    let allowRequestsFrom: string | null = null
    if (form.subOpenDate) {
      try {
        allowRequestsFrom = Temporal.PlainDateTime.from(
          `${form.subOpenDate}T${form.subOpenTime || '00:00'}`
        )
          .toZonedDateTime(form.timezone || 'UTC')
          .toInstant()
          .toString()
      } catch {
        allowRequestsFrom = null
      }
    }
    const { subOpenDate: _d, subOpenTime: _t, ...rest } = form
    const body = { ...rest, allowRequestsFrom }
    if (editing.value) {
      await useApiFetch(`/meetings/${editing.value.id}`, { method: 'PUT', body })
      toast.show('Meeting updated', 'ok')
    } else {
      await useApiFetch('/meetings', { method: 'POST', body })
      toast.show('Meeting added', 'ok')
    }
    modalOpen.value = false
    await meetingStore.fetchMeetings()
  } catch {
    toast.show('Failed to save meeting', 'bad')
  } finally {
    saving.value = false
  }
}

async function setActive(id: string) {
  try {
    await useApiFetch(`/meetings/${id}/activate`, { method: 'PATCH' })
    toast.show('Active meeting updated', 'ok')
    await meetingStore.fetchMeetings()
  } catch {
    toast.show('Failed to activate meeting', 'bad')
  }
}

async function deleteMeeting() {
  try {
    await useApiFetch(`/meetings/${confirmDel.value.id}`, { method: 'DELETE' })
    toast.show('Meeting deleted', 'ok')
    confirmDel.value = null
    await meetingStore.fetchMeetings()
  } catch {
    toast.show('Failed to delete meeting', 'bad')
  }
}

onMounted(async () => {
  await meetingStore.fetchMeetings()
  loading.value = false
})
</script>
