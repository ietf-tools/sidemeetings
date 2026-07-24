<template>
  <div v-if="loading" class="py-16 text-center text-text-dim">Loading…</div>
  <div v-else-if="!booking" class="py-16 text-center text-text-dim">Booking not found</div>
  <div v-else class="max-w-[1040px] mx-auto">
    <!-- Back -->
    <button
      class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-dim hover:text-text mb-4 transition-colors"
      @click="navigateTo('/admin/bookings')">
      <ChevronLeft class="w-4 h-4" /> Back to bookings
    </button>

    <!-- Title header -->
    <div class="mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-[23px] font-extrabold text-text tracking-tight">{{ booking.title }}</h1>
        <AdminStatusBadge :state="booking.state" />
      </div>
      <div class="text-[13px] text-text-dim mt-1.5">
        Submitted {{ formatSubmittedAt(booking.createdAt) }} by {{ booking.organizerName }}
      </div>
      <div class="text-xs text-text-faint mt-0.5">
        Booking ID <span class="font-mono">{{ booking.id }}</span>
      </div>
    </div>

    <div class="grid grid-cols-[1.5fr_1fr] gap-5 items-start">
      <!-- Edit details -->
      <div class="card p-[22px] flex flex-col gap-4">
        <h2 class="text-sm font-bold text-text">Edit details</h2>

        <div>
          <label class="form-label">Title</label>
          <input v-model="form.title" type="text" class="form-input" placeholder="Meeting title" />
        </div>

        <div>
          <label class="form-label">Description</label>
          <textarea
            ref="descRef"
            v-model="form.description"
            rows="3"
            class="form-input resize-none leading-relaxed overflow-y-auto"
            style="max-height: 250px; min-height: 76px"
            placeholder="What will this meeting cover?"
            @input="autoGrowDesc"></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Main organizer name</label>
            <input
              v-model="form.organizerName"
              type="text"
              class="form-input"
              placeholder="Full name" />
          </div>
          <div>
            <label class="form-label">Main organizer email</label>
            <input
              v-model="form.organizerEmail"
              type="email"
              class="form-input font-mono"
              placeholder="name@example.org" />
          </div>
        </div>

        <!-- Co-organizers -->
        <div>
          <label class="form-label">Co-organizers</label>
          <div v-if="form.coOrganizers.length" class="flex flex-col gap-2 mb-2.5">
            <div
              v-for="(co, i) in form.coOrganizers"
              :key="i"
              class="flex items-center gap-2.5 rounded-lg bg-s2 border border-border pl-3.5 pr-2 py-2">
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-semibold text-text truncate">{{ co.name }}</div>
                <div v-if="co.email" class="text-xs text-text-dim font-mono truncate">
                  {{ co.email }}
                </div>
              </div>
              <button
                type="button"
                title="Remove"
                class="w-6 h-6 flex-shrink-0 rounded-[7px] bg-s3 text-text-dim hover:text-bad flex items-center justify-center transition-colors"
                @click="removeCoOrg(i)">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
          <div class="flex gap-2">
            <input
              v-model="newCoName"
              type="text"
              class="form-input"
              placeholder="Name"
              @keydown.enter.prevent="addCoOrg" />
            <input
              v-model="newCoEmail"
              type="email"
              class="form-input font-mono"
              placeholder="Email"
              @keydown.enter.prevent="addCoOrg" />
            <button type="button" class="btn-secondary flex-shrink-0" @click="addCoOrg">Add</button>
          </div>
        </div>

        <!-- Meeting type -->
        <div>
          <label class="form-label">Meeting type</label>
          <div
            class="flex items-center gap-3 px-3.5 py-3 border border-border-strong rounded-lg cursor-pointer bg-surface transition-colors hover:border-text-faint"
            @click="form.isIrtf = !form.isIrtf">
            <div
              class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors border"
              :class="form.isIrtf ? 'bg-accent border-accent' : 'bg-surface border-border-strong'">
              <Check
                v-if="form.isIrtf"
                class="w-3 h-3"
                :stroke-width="3"
                style="color: var(--accent-text)" />
            </div>
            <div>
              <div class="text-[13.5px] font-semibold text-text">This is an IRTF meeting</div>
              <div class="text-[11.5px] text-text-dim">Leave unchecked for IETF side meetings</div>
            </div>
          </div>
        </div>

        <!-- Areas -->
        <div v-if="!form.isIrtf">
          <label class="form-label">
            IETF area(s) <span class="text-text-faint font-normal">· select one or more</span>
          </label>
          <AdminAreaChips v-model="form.areas" />
        </div>

        <!-- Schedule -->
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Room</label>
            <select v-model="form.roomId" class="form-input">
              <option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div>
            <label class="form-label">Day</label>
            <select v-model="form.date" class="form-input">
              <option v-for="d in meetingDays" :key="d.date" :value="d.date">{{ d.label }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Duration</label>
            <select v-model="form.duration" class="form-input">
              <option :value="60">60 minutes</option>
              <option :value="90">90 minutes</option>
              <option :value="120">120 minutes</option>
            </select>
          </div>
          <div>
            <label class="form-label">
              Start time <span class="text-text-faint font-normal">· 15-min steps</span>
            </label>
            <select v-model="form.startMinutes" class="form-input">
              <option v-for="slot in timeSlots" :key="slot.value" :value="slot.value">
                {{ slot.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Meeting link -->
        <div>
          <label class="form-label">Video tool link</label>
          <div class="flex gap-2 mb-2">
            <button
              type="button"
              class="text-[13px] font-semibold px-3 py-2 rounded-lg border transition-colors"
              :class="
                !form.customVideo
                  ? 'bg-accent text-accent-text border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="selectDefaultVideo">
              Webex (default)
            </button>
            <button
              type="button"
              class="text-[13px] font-semibold px-3 py-2 rounded-lg border transition-colors"
              :class="
                form.customVideo
                  ? 'bg-accent text-accent-text border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="form.customVideo = true">
              Custom link
            </button>
          </div>
          <input
            v-if="form.customVideo"
            v-model="form.videoLinkUrl"
            type="url"
            class="form-input font-mono"
            placeholder="https://…" />
        </div>

        <div class="flex gap-2.5 pt-4 border-t border-border">
          <button class="btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
          <button class="btn-secondary text-text-dim" :disabled="saving" @click="resetForm">
            Reset
          </button>
        </div>
      </div>

      <!-- Right: Summary + Decision -->
      <div class="flex flex-col gap-5">
        <!-- Summary -->
        <div class="card p-5">
          <h3 class="text-sm font-bold text-text mb-3.5">Summary</h3>
          <div class="flex flex-col gap-3.5">
            <div>
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">
                Organizer
              </p>
              <div class="text-[13.5px] font-semibold text-text mt-0.5">
                {{ booking.organizerName }}
              </div>
              <div class="text-xs text-text-dim font-mono">{{ booking.organizerEmail }}</div>
            </div>

            <div v-if="booking.coOrganizers?.length">
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">
                Co-organizers
              </p>
              <div v-for="co in booking.coOrganizers" :key="co.email" class="mt-1">
                <div class="text-[13.5px] font-semibold text-text">{{ co.name }}</div>
                <div v-if="co.email" class="text-xs text-text-dim font-mono">{{ co.email }}</div>
              </div>
            </div>

            <div v-if="!booking.isIrtf && booking.areas?.length">
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Areas</p>
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                <span
                  v-for="a in booking.areas"
                  :key="a"
                  class="text-xs font-semibold px-2 py-0.5 rounded-md text-accent bg-accent-weak border border-accent/30">
                  {{ a }}
                </span>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Room</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  :style="{ background: bookingRoomColor }"></span>
                <span class="text-[13.5px] font-semibold text-text">{{ booking.roomName }}</span>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">When</p>
              <div class="text-[13.5px] font-semibold text-text mt-0.5">{{ bookingDayLabel }}</div>
              <div class="text-[15px] font-bold text-text">
                {{ minutesToTime(bookingStartMinutes) }}–{{
                  minutesToTime(bookingStartMinutes + booking.duration)
                }}
              </div>
              <div class="text-xs text-text-dim font-mono">{{ bookingTimezone }}</div>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">
                Video Tool Link
              </p>
              <a
                v-if="effectiveVideoUrl"
                :href="effectiveVideoUrl"
                target="_blank"
                class="text-[12.5px] text-accent font-mono break-all block mt-0.5 hover:underline">
                {{ effectiveVideoUrl }}
              </a>
              <div v-else class="text-[12.5px] text-text-dim font-mono mt-0.5">
                IETF Webex (provided)
              </div>
              <div
                v-if="!booking.videoLinkUrl && effectiveVideoUrl"
                class="text-[11px] text-text-faint mt-0.5">
                Room default
              </div>
            </div>
          </div>
        </div>

        <!-- Decision -->
        <div class="card p-5">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
              <Megaphone class="w-3.5 h-3.5 text-text-dim" />
              <h3 class="text-sm font-bold text-text">Decision</h3>
            </div>
            <AdminStatusBadge :state="booking.state" />
          </div>
          <p class="text-[12.5px] text-text-dim mb-3.5">
            The organizer (and co-organizers if any) will be notified by email on approval. Only the
            main organizer will be notified on rejection.
          </p>
          <div class="flex flex-col gap-2.5">
            <div class="flex gap-2.5">
              <button
                class="flex-1 inline-flex items-center justify-center gap-2 p-3 rounded-[10px] bg-ok text-[#022c1c] text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="booking.state === 'confirmed'"
                @click="confirm">
                <Check class="w-4 h-4" :stroke-width="2.6" /> Approve request
              </button>
              <button
                class="flex-1 inline-flex items-center justify-center gap-2 p-[11px] rounded-[10px] border border-border-strong bg-surface text-bad text-[13px] font-semibold transition-colors hover:border-bad disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="booking.state === 'rejected'"
                @click="reject">
                <X class="w-4 h-4" :stroke-width="2.6" /> Reject request
              </button>
            </div>
          </div>

          <!-- Silent status change (no email sent) -->
          <div class="mt-6 pt-6 border-t border-border-strong">
            <div class="flex items-center gap-2 mb-2">
              <BellOff class="w-3.5 h-3.5 text-text-dim" />
              <h4 class="text-[13px] font-bold text-text">Silent status change</h4>
            </div>
            <p class="text-[12.5px] text-text-dim mb-3">
              Change the status without sending any confirmation or rejection email to the organizers.
            </p>
            <div class="flex gap-2.5">
              <select v-model="silentState" class="form-input flex-1">
                <option value="pending">Pending</option>
                <option value="confirmed">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                class="inline-flex items-center justify-center gap-2 px-4 rounded-[10px] border border-border-strong bg-surface text-text text-[13px] font-semibold transition-colors hover:border-text-dim disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="silentSaving || silentState === booking.state"
                @click="changeStatusSilently">
                Apply
              </button>
            </div>
          </div>

          <!-- Delete booking permanently -->
          <div class="mt-6 pt-6 border-t border-border-strong">
            <div class="flex items-center gap-2 mb-2">
              <Trash2 class="w-3.5 h-3.5 text-text-dim" />
              <h4 class="text-[13px] font-bold text-text">Delete booking</h4>
            </div>
            <p class="text-[12.5px] text-text-dim mb-3">
              Permanently remove this booking and its history. This cannot be undone and no email is
              sent.
            </p>
            <div class="flex justify-end">
              <button
                class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-strong bg-surface text-text-dim text-[12px] font-semibold transition-colors hover:border-bad hover:text-bad disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="deleting"
                @click="deleteConfirmOpen = true">
                <Trash2 class="w-3.5 h-3.5" /> Delete booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AdminDeleteConfirm
      v-model="deleteConfirmOpen"
      title="Delete booking"
      message="Permanently delete this booking and its history? This cannot be undone and no email is sent to the organizers."
      confirm-text="Delete booking"
      @confirm="deleteBooking">
      <p class="text-sm text-text-dim">
        Consider setting the status to <span class="font-semibold text-text">Cancelled</span> instead
        to keep a trace of the side meeting request. Deleting a booking should only be done as a last
        resort.
      </p>
    </AdminDeleteConfirm>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, X, Check, Megaphone, BellOff, Trash2 } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Booking details'
pageSubtitle.value = ''

const route = useRoute()
const toast = useToastStore()
const meetingStore = useMeetingStore()
const { minutesToTime, getMeetingDays, formatSubmittedAt } = useTemporal()

const loading = ref(true)
const saving = ref(false)
const silentSaving = ref(false)
const silentState = ref('pending')
const deleting = ref(false)
const deleteConfirmOpen = ref(false)
const booking = ref<any>(null)
const rooms = ref<any[]>([])

const newCoName = ref('')
const newCoEmail = ref('')

// Auto-grow the description textarea with its content, up to a max height.
const descRef = ref<HTMLTextAreaElement | null>(null)
function autoGrowDesc() {
  const el = descRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 250)}px`
}

const form = reactive({
  title: '',
  description: '',
  organizerName: '',
  organizerEmail: '',
  coOrganizers: [] as { name: string; email: string }[],
  isIrtf: false,
  areas: [] as string[],
  roomId: '',
  date: '',
  duration: 60,
  startMinutes: 480,
  customVideo: false,
  videoLinkUrl: ''
})

const bookingStartMinutes = computed(() => {
  if (!booking.value?.startsAt) return 0
  const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
  try {
    const zdt = Temporal.Instant.from(booking.value.startsAt).toZonedDateTimeISO(tz)
    return zdt.hour * 60 + zdt.minute
  } catch {
    return 0
  }
})

const bookingDayLabel = computed(() => {
  if (!booking.value?.startsAt) return ''
  const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
  try {
    const zdt = Temporal.Instant.from(booking.value.startsAt).toZonedDateTimeISO(tz)
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return `${days[zdt.dayOfWeek - 1]} ${zdt.day}`
  } catch {
    return ''
  }
})

const bookingTimezone = computed(() => meetingStore.viewingMeeting?.timezone || 'UTC')

// The link actually in effect: the booking's custom link, or the room's current
// default when the booking uses "Default" (null stored value).
const effectiveVideoUrl = computed(
  () => booking.value?.videoLinkUrl || booking.value?.roomVideoLinkUrl || ''
)

const ROOM_COLORS: Record<string, string> = {
  sky: '#38bdf8',
  yellow: '#fbbf24',
  purple: '#a78bfa',
  emerald: '#34d399',
  indigo: '#818cf8'
}

// Color dot for the booking's room, matched from the loaded room list.
const bookingRoomColor = computed(() => {
  const room = rooms.value.find((r) => r.id === booking.value?.roomId)
  return (room?.color && ROOM_COLORS[room.color]) || '#2dd4bf'
})

const meetingDays = computed(() => {
  if (!meetingStore.viewingMeeting) return []
  return getMeetingDays(meetingStore.viewingMeeting)
})

const timeSlots = computed(() => {
  const slots = []
  for (let m = 7 * 60; m <= 22 * 60; m += 15) {
    slots.push({ value: m, label: minutesToTime(m) })
  }
  return slots
})

function addCoOrg() {
  if (newCoName.value && newCoEmail.value) {
    form.coOrganizers.push({ name: newCoName.value, email: newCoEmail.value })
    newCoName.value = ''
    newCoEmail.value = ''
  }
}

function removeCoOrg(i: number) {
  form.coOrganizers.splice(i, 1)
}

// Switch back to the room's default video link (clears any custom URL).
function selectDefaultVideo() {
  form.customVideo = false
  form.videoLinkUrl = ''
}

// Populate the editable form from a booking record (used on load and on reset).
function applyForm(b: any) {
  const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
  let bookingDate = ''
  let startMinutes = 480
  try {
    const zdt = Temporal.Instant.from(b.startsAt).toZonedDateTimeISO(tz)
    bookingDate = zdt.toPlainDate().toString()
    startMinutes = zdt.hour * 60 + zdt.minute
  } catch {
    /* keep defaults */
  }

  Object.assign(form, {
    title: b.title,
    description: b.description,
    organizerName: b.organizerName,
    organizerEmail: b.organizerEmail,
    coOrganizers: b.coOrganizers ? [...b.coOrganizers] : [],
    isIrtf: b.isIrtf,
    areas: b.areas ? [...b.areas] : [],
    roomId: b.roomId,
    date: bookingDate,
    duration: b.duration,
    startMinutes,
    customVideo: !!b.videoLinkUrl,
    videoLinkUrl: b.videoLinkUrl || ''
  })
  nextTick(autoGrowDesc)
}

// Revert unsaved edits back to the last loaded booking.
function resetForm() {
  if (booking.value) {
    applyForm(booking.value)
    newCoName.value = ''
    newCoEmail.value = ''
  }
}

async function loadBooking() {
  loading.value = true
  try {
    const [b, roomList] = await Promise.all([
      useApiFetch<any>(`/bookings/${route.params.id}`),
      meetingStore.viewingMeeting
        ? useApiFetch<any[]>(`/meetings/${meetingStore.viewingMeeting.id}/rooms`)
        : Promise.resolve([])
    ])
    booking.value = b
    rooms.value = roomList
    silentState.value = b.state
    applyForm(b)
  } catch {
    toast.show('Failed to load booking', 'bad')
  } finally {
    loading.value = false
    // Size the description once the form is actually in the DOM.
    nextTick(autoGrowDesc)
  }
}

async function save() {
  saving.value = true
  try {
    // Convert date + startMinutes back to an ISO timestamp in the meeting timezone
    const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
    let startsAt: string | undefined
    try {
      const date = Temporal.PlainDate.from(form.date)
      const dt = date.toPlainDateTime({
        hour: Math.floor(form.startMinutes / 60),
        minute: form.startMinutes % 60
      })
      startsAt = dt.toZonedDateTime(tz).toInstant().toString()
    } catch {
      /* leave startsAt undefined if conversion fails */
    }

    await useApiFetch(`/bookings/${route.params.id}`, {
      method: 'PUT',
      body: {
        title: form.title,
        description: form.description,
        organizerName: form.organizerName,
        organizerEmail: form.organizerEmail,
        coOrganizers: form.coOrganizers,
        isIrtf: form.isIrtf,
        areas: form.isIrtf ? [] : form.areas,
        roomId: form.roomId,
        duration: form.duration,
        startsAt,
        videoLinkUrl: form.customVideo ? form.videoLinkUrl : null
      }
    })
    toast.show('Changes saved', 'ok')
    await loadBooking()
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to save changes', 'bad')
  } finally {
    saving.value = false
  }
}

async function confirm() {
  try {
    await useApiFetch(`/bookings/${route.params.id}/confirm`, { method: 'PATCH' })
    toast.show('Booking confirmed', 'ok')
    await loadBooking()
  } catch {
    toast.show('Failed to confirm', 'bad')
  }
}

async function reject() {
  try {
    await useApiFetch(`/bookings/${route.params.id}/reject`, { method: 'PATCH' })
    toast.show('Booking rejected', 'bad')
    await loadBooking()
  } catch {
    toast.show('Failed to reject', 'bad')
  }
}

// Change the state via PUT /bookings/:id, which never sends organizer emails.
async function changeStatusSilently() {
  silentSaving.value = true
  try {
    await useApiFetch(`/bookings/${route.params.id}`, {
      method: 'PUT',
      body: { state: silentState.value }
    })
    toast.show('Status changed silently (no email sent)', 'ok')
    await loadBooking()
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to change status', 'bad')
  } finally {
    silentSaving.value = false
  }
}

// Permanently delete the booking, then return to the list.
async function deleteBooking() {
  deleting.value = true
  try {
    await useApiFetch(`/bookings/${route.params.id}`, { method: 'DELETE' })
    toast.show('Booking deleted', 'ok')
    await navigateTo('/admin/bookings')
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to delete booking', 'bad')
    deleting.value = false
  }
}

onMounted(async () => {
  await meetingStore.fetchMeetings()
  await loadBooking()
})
</script>
