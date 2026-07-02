<template>
  <div class="max-w-[1180px] mx-auto">
    <!-- Filter tabs + search -->
    <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-colors"
          :class="
            activeFilter === tab.key
              ? 'bg-accent text-accent-text border-accent'
              : 'bg-surface text-text-dim border-border hover:text-text'
          "
          @click="activeFilter = tab.key">
          {{ tab.label }}
          <span class="font-mono text-[11.5px] opacity-60">{{ tab.count }}</span>
        </button>
      </div>
      <div class="flex items-center gap-2 w-full max-w-[460px]">
        <div class="relative flex items-center flex-1">
          <Search class="w-4 h-4 text-text-faint absolute left-3 pointer-events-none" />
          <input
            v-model="search"
            type="text"
            placeholder="Search bookings…"
            class="w-full h-[38px] pl-9 pr-3 rounded-lg bg-surface border border-border-strong text-text text-[13.5px] outline-none focus:border-accent transition-colors" />
        </div>
        <button class="btn-primary flex-shrink-0 h-[38px]" @click="openCreate">
          <Plus class="w-4 h-4" /> Create
        </button>
        <div class="relative flex-shrink-0">
          <button
            class="w-[38px] h-[38px] rounded-lg bg-surface border border-border-strong text-text-dim flex items-center justify-center transition-colors hover:text-text hover:border-text-faint"
            title="More actions"
            @click="menuOpen = !menuOpen">
            <MoreHorizontal class="w-4 h-4" />
          </button>
          <template v-if="menuOpen">
            <div class="fixed inset-0 z-30" @click="menuOpen = false"></div>
            <div
              class="absolute right-0 top-full mt-2 z-40 w-52 bg-surface border border-border rounded-xl shadow-card p-1.5">
              <button
                class="w-full text-left px-3 py-2 rounded-lg text-[13px] text-text hover:bg-s2 flex items-center gap-2.5 transition-colors"
                @click="openImport">
                <FileUp class="w-4 h-4 text-text-dim" /> Import from JSON…
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <div v-if="loading" class="py-16 text-center text-text-dim text-sm">Loading…</div>
      <div v-else-if="!filteredBookings.length" class="py-16 text-center">
        <div class="text-[15px] font-semibold text-text-dim">No bookings found</div>
        <div class="text-[13px] text-text-faint mt-1">Try a different filter or search term.</div>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="bg-s2">
            <th
              class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-5 py-3">
              Side meeting
            </th>
            <th
              class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">
              Room
            </th>
            <th
              class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">
              Time
            </th>
            <th
              class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">
              Status
            </th>
            <th
              class="text-right text-[11px] font-bold uppercase tracking-wide text-text-dim px-5 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="b in filteredBookings"
            :key="b.id"
            class="group cursor-pointer hover:bg-s2 transition-colors"
            @click="navigateTo('/admin/bookings/' + b.id)">
            <td class="px-5 py-3.5">
              <div
                class="text-sm font-semibold text-text"
                :class="{
                  'line-through text-text-faint': b.state === 'rejected' || b.state === 'cancelled'
                }">
                {{ b.title }}
              </div>
              <div class="text-xs text-text-dim mt-0.5">{{ b.organizerName }}</div>
            </td>
            <td class="px-4 py-3.5">
              <span class="text-[13px] text-text">{{ b.roomName }}</span>
            </td>
            <td class="px-4 py-3.5 whitespace-nowrap">
              <template v-if="b.startsAt">
                <div class="text-[12.5px] font-semibold text-text">
                  {{ bookingTimeLabel(b.startsAt, b.duration).day }}
                </div>
                <div class="text-[11.5px] text-text-dim font-mono">
                  {{ bookingTimeLabel(b.startsAt, b.duration).start }}–{{
                    bookingTimeLabel(b.startsAt, b.duration).end
                  }}
                </div>
              </template>
            </td>
            <td class="px-4 py-3.5">
              <AdminStatusBadge :state="b.state" />
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-2 justify-end">
                <template v-if="b.state === 'pending'">
                  <button class="icon-btn text-bad" title="Reject" @click.stop="reject(b.id)">
                    <X class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="w-[30px] h-[30px] rounded-lg bg-ok text-white flex items-center justify-center transition-opacity hover:opacity-90"
                    title="Approve"
                    @click.stop="approve(b.id)">
                    <Check class="w-3.5 h-3.5" :stroke-width="2.6" />
                  </button>
                </template>
                <ChevronRight
                  class="w-4 h-4 text-text-faint transition-all group-hover:text-text group-hover:translate-x-0.5" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create booking dialog -->
    <AdminModal
      v-model="createOpen"
      title="Create side meeting"
      subtitle="Manually add an approved booking"
      size="lg">
      <div class="px-6 py-4 flex flex-col gap-4">
        <div>
          <label class="form-label">Title</label>
          <input
            v-model="createForm.title"
            type="text"
            class="form-input"
            placeholder="Meeting title" />
        </div>

        <div>
          <label class="form-label">Description</label>
          <textarea
            v-model="createForm.description"
            rows="3"
            class="form-input resize-none leading-relaxed"
            placeholder="What will this meeting cover?"></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Main organizer name</label>
            <input
              v-model="createForm.organizerName"
              type="text"
              class="form-input"
              placeholder="Full name" />
          </div>
          <div>
            <label class="form-label">Main organizer email</label>
            <input
              v-model="createForm.organizerEmail"
              type="email"
              class="form-input font-mono"
              placeholder="name@example.org" />
          </div>
        </div>

        <!-- Co-organizers -->
        <div>
          <label class="form-label">Co-organizers</label>
          <div v-if="createForm.coOrganizers.length" class="flex flex-col gap-2 mb-2.5">
            <div
              v-for="(co, i) in createForm.coOrganizers"
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
                @click="removeCreateCoOrg(i)">
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
              @keydown.enter.prevent="addCreateCoOrg" />
            <input
              v-model="newCoEmail"
              type="email"
              class="form-input font-mono"
              placeholder="Email"
              @keydown.enter.prevent="addCreateCoOrg" />
            <button type="button" class="btn-secondary flex-shrink-0" @click="addCreateCoOrg">
              Add
            </button>
          </div>
        </div>

        <!-- Meeting type -->
        <div>
          <label class="form-label">Meeting type</label>
          <div
            class="flex items-center gap-3 px-3.5 py-3 border border-border-strong rounded-lg cursor-pointer bg-surface transition-colors hover:border-text-faint"
            @click="createForm.isIrtf = !createForm.isIrtf">
            <div
              class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors border"
              :class="
                createForm.isIrtf ? 'bg-accent border-accent' : 'bg-surface border-border-strong'
              ">
              <Check
                v-if="createForm.isIrtf"
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
        <div v-if="!createForm.isIrtf">
          <label class="form-label">
            IETF area(s) <span class="text-text-faint font-normal">· select one or more</span>
          </label>
          <AdminAreaChips v-model="createForm.areas" />
        </div>

        <!-- Schedule -->
        <div v-if="!rooms.length" class="text-[13px] text-warn">
          This meeting has no rooms yet. Add a room before creating a booking.
        </div>
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Room</label>
            <select v-model="createForm.roomId" class="form-input">
              <option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div>
            <label class="form-label">Day</label>
            <select v-model="createForm.date" class="form-input">
              <option v-for="d in meetingDays" :key="d.date" :value="d.date">{{ d.label }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="form-label">Duration</label>
            <select v-model="createForm.duration" class="form-input">
              <option :value="60">60 minutes</option>
              <option :value="90">90 minutes</option>
              <option :value="120">120 minutes</option>
            </select>
          </div>
          <div>
            <label class="form-label">
              Start time <span class="text-text-faint font-normal">· 15-min steps</span>
            </label>
            <select v-model="createForm.startMinutes" class="form-input">
              <option v-for="slot in timeSlots" :key="slot.value" :value="slot.value">
                {{ slot.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Video tool link -->
        <div>
          <label class="form-label">Video tool link</label>
          <div class="flex gap-2 mb-2">
            <button
              type="button"
              class="text-[13px] font-semibold px-3 py-2 rounded-lg border transition-colors"
              :class="
                !createForm.customVideo
                  ? 'bg-accent text-accent-text border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="createSelectDefaultVideo">
              Webex (default)
            </button>
            <button
              type="button"
              class="text-[13px] font-semibold px-3 py-2 rounded-lg border transition-colors"
              :class="
                createForm.customVideo
                  ? 'bg-accent text-accent-text border-accent'
                  : 'bg-surface text-text-dim border-border-strong hover:text-text'
              "
              @click="createForm.customVideo = true">
              Custom link
            </button>
          </div>
          <input
            v-if="createForm.customVideo"
            v-model="createForm.videoLinkUrl"
            type="url"
            class="form-input font-mono"
            placeholder="https://…" />
        </div>

        <!-- Notify -->
        <div>
          <label class="form-label">Email notification</label>
          <div
            class="flex items-center gap-3 px-3.5 py-3 border border-border-strong rounded-lg cursor-pointer bg-surface transition-colors hover:border-text-faint"
            @click="createForm.notify = !createForm.notify">
            <div
              class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors border"
              :class="
                createForm.notify ? 'bg-accent border-accent' : 'bg-surface border-border-strong'
              ">
              <Check
                v-if="createForm.notify"
                class="w-3 h-3"
                :stroke-width="3"
                style="color: var(--accent-text)" />
            </div>
            <div>
              <div class="text-[13.5px] font-semibold text-text">Notify organizers by email</div>
              <div class="text-[11.5px] text-text-dim">
                Send an approved email with a calendar invite to the organizer and co-organizers.
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button class="btn-secondary" :disabled="creating" @click="createOpen = false">
            Cancel
          </button>
          <button class="btn-primary" :disabled="creating || !canCreate" @click="createBooking">
            {{ creating ? 'Creating…' : 'Create booking' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- Import from JSON dialog -->
    <AdminModal v-model="importOpen" title="Import bookings from JSON" size="lg">
      <div class="px-6 py-4 space-y-3">
        <p class="text-[13px] text-text-dim leading-relaxed">
          Paste a JSON array of bookings (the
          <code class="font-mono text-text">bookings</code> array from a legacy export). They will
          be imported into <b class="text-text">{{ viewingMeetingLabel }}</b> as
          <b class="text-text">approved</b> bookings. Rooms are matched by name; entries with an
          unknown room or a title of <code class="font-mono text-text">UNAVAILABLE</code> are
          skipped.
        </p>
        <textarea
          v-model="importText"
          rows="14"
          spellcheck="false"
          placeholder='[ { "roomName": "Hunan", "title": "…", "start": "…", "end": "…", "organizerName": "…", "organizerEmail": "…", "areas": [] } ]'
          class="form-input font-mono text-xs resize-y w-full"></textarea>
        <p v-if="importError" class="text-xs text-bad">{{ importError }}</p>
        <div
          v-if="importResult"
          class="rounded-lg border border-border bg-s2 px-3.5 py-2.5 text-[13px]">
          <div class="text-ok font-semibold">Imported {{ importResult.imported }} booking(s)</div>
          <div class="text-text-dim mt-0.5">
            Skipped / failed: {{ importResult.skipped + importResult.failed }}
            <span class="text-text-faint"
              >({{ importResult.skipped }} skipped, {{ importResult.failed }} failed)</span
            >
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button class="btn-secondary" :disabled="importing" @click="importOpen = false">
            Close
          </button>
          <button
            class="btn-primary"
            :disabled="importing || !importText.trim()"
            @click="runImport">
            {{ importing ? 'Importing…' : 'Import' }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { Search, X, Check, Plus, ChevronRight, MoreHorizontal, FileUp } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Bookings'
pageSubtitle.value = 'Manage side meeting requests'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const route = useRoute()
const { minutesToTime, getMeetingDays } = useTemporal()

const loading = ref(true)
const bookings = ref<any[]>([])
const rooms = ref<any[]>([])
const search = ref('')
const activeFilter = ref((route.query.filter as string) || 'all')

// Create-booking dialog state
const createOpen = ref(false)
const creating = ref(false)
const newCoName = ref('')
const newCoEmail = ref('')
const createForm = reactive({
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
  videoLinkUrl: '',
  notify: false
})

const meetingDays = computed(() =>
  meetingStore.viewingMeeting ? getMeetingDays(meetingStore.viewingMeeting) : []
)

const timeSlots = computed(() => {
  const slots = []
  for (let m = 7 * 60; m <= 22 * 60; m += 15) slots.push({ value: m, label: minutesToTime(m) })
  return slots
})

const canCreate = computed(
  () =>
    !!(
      createForm.title.trim() &&
      createForm.organizerName.trim() &&
      createForm.organizerEmail.trim() &&
      createForm.roomId &&
      createForm.date
    )
)

function openCreate() {
  Object.assign(createForm, {
    title: '',
    description: '',
    organizerName: '',
    organizerEmail: '',
    coOrganizers: [],
    isIrtf: false,
    areas: [],
    roomId: rooms.value[0]?.id || '',
    date: meetingDays.value[0]?.date || '',
    duration: 60,
    startMinutes: 480,
    customVideo: false,
    videoLinkUrl: '',
    notify: false
  })
  newCoName.value = ''
  newCoEmail.value = ''
  createOpen.value = true
}

function addCreateCoOrg() {
  if (newCoName.value && newCoEmail.value) {
    createForm.coOrganizers.push({ name: newCoName.value, email: newCoEmail.value })
    newCoName.value = ''
    newCoEmail.value = ''
  }
}

function removeCreateCoOrg(i: number) {
  createForm.coOrganizers.splice(i, 1)
}

function createSelectDefaultVideo() {
  createForm.customVideo = false
  createForm.videoLinkUrl = ''
}

async function createBooking() {
  if (!meetingStore.viewingMeeting || !canCreate.value) return
  creating.value = true
  try {
    const tz = meetingStore.viewingMeeting.timezone || 'UTC'
    let startsAt: string
    try {
      const date = Temporal.PlainDate.from(createForm.date)
      const dt = date.toPlainDateTime({
        hour: Math.floor(createForm.startMinutes / 60),
        minute: createForm.startMinutes % 60
      })
      startsAt = dt.toZonedDateTime(tz).toInstant().toString()
    } catch {
      toast.show('Invalid date/time', 'bad')
      creating.value = false
      return
    }

    await useApiFetch(`/meetings/${meetingStore.viewingMeeting.id}/bookings/manual`, {
      method: 'POST',
      body: {
        title: createForm.title,
        description: createForm.description,
        organizerName: createForm.organizerName,
        organizerEmail: createForm.organizerEmail,
        coOrganizers: createForm.coOrganizers,
        isIrtf: createForm.isIrtf,
        areas: createForm.isIrtf ? [] : createForm.areas,
        roomId: createForm.roomId,
        startsAt,
        duration: createForm.duration,
        videoLinkUrl: createForm.customVideo ? createForm.videoLinkUrl : null,
        notify: createForm.notify
      }
    })
    toast.show('Booking created', 'ok')
    createOpen.value = false
    await loadBookings()
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to create booking', 'bad')
  } finally {
    creating.value = false
  }
}

async function loadRooms() {
  if (!meetingStore.viewingMeeting) return
  try {
    rooms.value = await useApiFetch<any[]>(`/meetings/${meetingStore.viewingMeeting.id}/rooms`)
  } catch {
    // ignore — the create dialog will show the "no rooms" hint
  }
}

// "..." menu + JSON import dialog state
const menuOpen = ref(false)
const importOpen = ref(false)
const importText = ref('')
const importError = ref('')
const importing = ref(false)
const importResult = ref<{ imported: number; skipped: number; failed: number } | null>(null)

const viewingMeetingLabel = computed(() => {
  const m = meetingStore.viewingMeeting
  return m ? `IETF ${m.num} — ${m.city}, ${m.country}` : 'the current meeting'
})

function openImport() {
  menuOpen.value = false
  importText.value = ''
  importError.value = ''
  importResult.value = null
  importOpen.value = true
}

async function runImport() {
  importError.value = ''
  importResult.value = null

  let parsed: any
  try {
    parsed = JSON.parse(importText.value)
  } catch (e: any) {
    importError.value = `Invalid JSON: ${e.message}`
    return
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.bookings)
      ? parsed.bookings
      : null
  if (!arr) {
    importError.value = 'Expected a JSON array of bookings (or an object with a "bookings" array).'
    return
  }
  if (!meetingStore.viewingMeeting) {
    importError.value = 'No meeting selected.'
    return
  }

  importing.value = true
  try {
    const res = await useApiFetch<{ imported: number; skipped: number; failed: number }>(
      `/meetings/${meetingStore.viewingMeeting.id}/bookings/import`,
      { method: 'POST', body: { bookings: arr } }
    )
    importResult.value = res
    importText.value = ''
    const failedOrSkipped = (res.skipped || 0) + (res.failed || 0)
    toast.show(
      `Imported ${res.imported} booking(s), ${failedOrSkipped} skipped/failed`,
      res.imported ? 'ok' : 'bad'
    )
    await loadBookings()
  } catch {
    importError.value = 'Import failed. Please check the data and try again.'
  } finally {
    importing.value = false
  }
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: bookings.value.length },
  {
    key: 'pending',
    label: 'Pending',
    count: bookings.value.filter((b) => b.state === 'pending').length
  },
  {
    key: 'confirmed',
    label: 'Approved',
    count: bookings.value.filter((b) => b.state === 'confirmed').length
  },
  {
    key: 'rejected',
    label: 'Rejected',
    count: bookings.value.filter((b) => b.state === 'rejected').length
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    count: bookings.value.filter((b) => b.state === 'cancelled').length
  }
])

const filteredBookings = computed(() => {
  let list = bookings.value
  if (activeFilter.value !== 'all') {
    list = list.filter((b) => b.state === activeFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (b) => b.title.toLowerCase().includes(q) || b.organizerName?.toLowerCase().includes(q)
    )
  }
  return list
})

function bookingTimeLabel(
  startsAt: string,
  duration: number
): { day: string; start: string; end: string } {
  const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
  try {
    const zdt = Temporal.Instant.from(startsAt).toZonedDateTimeISO(tz)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayLabel = `${days[zdt.dayOfWeek - 1]} ${zdt.day}`
    const startMin = zdt.hour * 60 + zdt.minute
    return {
      day: dayLabel,
      start: minutesToTime(startMin),
      end: minutesToTime(startMin + duration)
    }
  } catch {
    return { day: '', start: '', end: '' }
  }
}

async function loadBookings() {
  if (!meetingStore.viewingMeeting) return
  loading.value = true
  try {
    bookings.value = await useApiFetch<any[]>(
      `/meetings/${meetingStore.viewingMeeting.id}/bookings`
    )
  } catch {
    toast.show('Failed to load bookings', 'bad')
  } finally {
    loading.value = false
  }
}

async function approve(id: string) {
  try {
    await useApiFetch(`/bookings/${id}/confirm`, { method: 'PATCH' })
    toast.show('Booking approved', 'ok')
    await loadBookings()
  } catch {
    toast.show('Failed to approve booking', 'bad')
  }
}

async function reject(id: string) {
  try {
    await useApiFetch(`/bookings/${id}/reject`, { method: 'PATCH' })
    toast.show('Booking rejected', 'bad')
    await loadBookings()
  } catch {
    toast.show('Failed to reject booking', 'bad')
  }
}

watch(
  () => meetingStore.viewingMeeting?.id,
  () => {
    loadBookings()
    loadRooms()
  }
)
onMounted(() => {
  loadBookings()
  loadRooms()
})
</script>
