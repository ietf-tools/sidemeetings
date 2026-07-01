<template>
  <div class="max-w-[1180px] mx-auto">
    <div class="flex justify-end mb-5">
      <button class="btn-primary" @click="openAddRoom"><Plus class="w-4 h-4" /> Add room</button>
    </div>

    <div v-if="loading" class="py-16 text-center text-text-dim">Loading…</div>
    <div v-else>
      <!-- Room cards -->
      <div v-if="rooms.length" class="flex flex-wrap gap-3.5 mb-5">
        <div
          v-for="room in rooms"
          :key="room.id"
          class="card p-4 cursor-pointer transition-all flex-1 min-w-[248px] max-w-[50%] hover:border-border-strong"
          :class="selectedRoom?.id === room.id ? '!border-accent shadow-room-selected' : ''"
          @click="selectedRoom = room">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 text-[15px] font-bold text-text min-w-0">
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :style="{ background: roomColorHex(room.color) }"></span>
              <span class="truncate">{{ room.name }}</span>
            </div>
            <span
              class="font-mono text-[11px] text-text-dim bg-s2 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
              cap {{ room.capacity }}
            </span>
          </div>
          <p class="text-[12.5px] text-text-dim mt-2 leading-relaxed">
            {{ room.description || 'No description.' }}
          </p>
          <div class="flex items-center gap-3.5 text-[12.5px] text-text-dim mt-2.5">
            <span>
              <b class="text-text">{{ room.bookingCount ?? 0 }}</b> booked ·
              <b class="text-text">{{ roomFreeHours(room) }}h</b> free
            </span>
          </div>
          <div class="mt-2.5">
            <div class="flex items-center justify-between text-[11px] mb-1">
              <span class="text-text-faint">Utilization</span>
              <span class="font-mono text-text-dim">{{ roomUtilizationPct(room) }}%</span>
            </div>
            <div class="h-[7px] rounded-md bg-s3 overflow-hidden flex">
              <div
                class="h-full bg-accent transition-all"
                :style="{ width: roomBookedPct(room) + '%' }"></div>
              <div
                class="h-full bg-warn transition-all"
                :style="{ width: roomBlockedPct(room) + '%' }"></div>
            </div>
            <div class="flex items-center gap-3 mt-1.5 text-[10px] text-text-faint">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-accent"></span> Booked
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-warn"></span> Unallocatable
              </span>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border-strong bg-surface text-text text-[12.5px] font-semibold transition-colors hover:border-text-faint"
              @click.stop="openEditRoom(room)">
              <Pencil class="w-3.5 h-3.5" /> Edit
            </button>
            <button
              class="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-border-strong bg-surface text-bad transition-colors hover:border-bad"
              title="Delete room"
              @click.stop="confirmDeleteRoom = room">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!rooms.length" class="card py-16 text-center">
        <div class="text-[15px] font-semibold text-text-dim">No rooms yet</div>
        <div class="text-[13px] text-text-faint mt-1">
          Add a room to start scheduling side meetings.
        </div>
      </div>

      <!-- Schedule grid -->
      <div v-else-if="selectedRoom" class="card overflow-hidden">
        <div class="px-[18px] py-4 border-b border-border flex items-start justify-between gap-3">
          <div class="max-w-[540px]">
            <div class="text-[15px] font-bold text-text">
              {{ selectedRoom.name }} · week schedule
            </div>
            <div v-if="selectedRoom.description" class="text-xs text-text-dim mt-1">
              {{ selectedRoom.description }}
            </div>
            <div class="text-[11.5px] text-text-faint mt-1">
              Click a booked slot to open the request
            </div>
          </div>
          <div
            class="flex items-center gap-3.5 text-[11.5px] text-text-dim flex-wrap flex-shrink-0">
            <span class="flex items-center gap-1.5"
              ><span
                class="w-2.5 h-2.5 rounded-sm inline-block"
                style="
                  background: color-mix(in srgb, #34d399 22%, transparent);
                  border: 1px solid #34d399;
                "></span>
              Approved</span
            >
            <span class="flex items-center gap-1.5"
              ><span
                class="w-2.5 h-2.5 rounded-sm inline-block"
                style="
                  background: color-mix(in srgb, #e3a93b 22%, transparent);
                  border: 1px solid #e3a93b;
                "></span>
              Pending</span
            >
            <span class="flex items-center gap-1.5"
              ><span
                class="w-2.5 h-2.5 rounded-sm inline-block cell-closed border border-border-strong"></span>
              Closed</span
            >
          </div>
        </div>
        <AdminScheduleGrid
          :room="selectedRoom"
          :meeting="meetingStore.viewingMeeting"
          :bookings="roomBookings"
          @booking-click="(id) => navigateTo('/admin/bookings/' + id)" />
      </div>
    </div>

    <!-- Add/Edit Room Modal -->
    <AdminModal v-model="roomModalOpen" :title="editingRoom ? 'Edit room' : 'Add room'" size="lg">
      <div class="space-y-4 px-6 py-4">
        <div>
          <label class="form-label">Room name *</label>
          <input
            v-model="roomForm.name"
            type="text"
            class="form-input"
            placeholder="e.g. Albéniz" />
        </div>
        <div>
          <label class="form-label">Capacity *</label>
          <input
            v-model.number="roomForm.capacity"
            type="number"
            class="form-input"
            min="1"
            placeholder="e.g. 30" />
        </div>
        <div>
          <label class="form-label">Description *</label>
          <textarea
            v-model="roomForm.description"
            rows="2"
            class="form-input resize-none"
            placeholder="Short description of the room"></textarea>
        </div>
        <div class="grid grid-cols-[1fr_2fr] gap-3">
          <div>
            <label class="form-label">Video tool name</label>
            <input
              v-model="roomForm.videoLinkName"
              type="text"
              class="form-input"
              placeholder="e.g. Webex" />
          </div>
          <div>
            <label class="form-label">Video Tool Link</label>
            <input
              v-model="roomForm.videoLinkUrl"
              type="url"
              class="form-input font-mono"
              placeholder="https://…" />
          </div>
        </div>
        <div class="text-[11.5px] text-text-faint -mt-2">
          Used as the default meeting link when an organizer doesn't provide their own.
        </div>
        <div>
          <label class="form-label">Color</label>
          <AdminColorPicker v-model="roomForm.color" :colors="ROOM_COLORS" />
        </div>

        <!-- Availability -->
        <div>
          <label class="form-label">
            Availability periods
            <span class="text-text-faint font-normal">· add one or more time periods per day</span>
          </label>
          <div class="flex flex-col gap-2.5">
            <div
              v-for="day in availabilityDays"
              :key="day.key"
              class="rounded-xl border border-border bg-s2 px-3.5 py-3">
              <div class="flex items-center justify-between gap-2.5">
                <div class="text-[13px] font-bold text-text min-w-[64px]">
                  {{ day.name }}
                  <span v-if="day.num" class="text-text-faint font-medium">{{ day.num }}</span>
                </div>
                <button
                  class="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-lg border border-border-strong bg-surface text-accent text-xs font-semibold transition-colors hover:bg-accent-weak hover:border-accent"
                  @click="addPeriod(day.key)">
                  <Plus class="w-3 h-3" /> Add period
                </button>
              </div>
              <div
                v-if="(roomForm.availability[day.key] || []).length"
                class="flex flex-col gap-2 mt-2.5">
                <div
                  v-for="(period, pi) in roomForm.availability[day.key]"
                  :key="pi"
                  class="flex items-center gap-2">
                  <select
                    v-model="period.s"
                    class="form-input font-mono text-[13px] py-2 flex-1 !bg-surface">
                    <option v-for="t in TIME_OPTIONS" :key="t.value" :value="t.value">
                      {{ t.label }}
                    </option>
                  </select>
                  <span class="text-text-dim text-xs">to</span>
                  <select
                    v-model="period.e"
                    class="form-input font-mono text-[13px] py-2 flex-1 !bg-surface">
                    <option v-for="t in TIME_OPTIONS" :key="t.value" :value="t.value">
                      {{ t.label }}
                    </option>
                  </select>
                  <button
                    class="icon-btn text-bad flex-shrink-0"
                    title="Remove period"
                    @click="removePeriod(day.key, pi)">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-else class="text-xs text-text-faint mt-2">
                Closed — no availability this day.
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button class="btn-secondary" @click="roomModalOpen = false">Cancel</button>
          <button
            class="btn-primary"
            :disabled="saving || !roomForm.description.trim()"
            @click="saveRoom">
            {{ saving ? 'Saving…' : editingRoom ? 'Save changes' : 'Add room' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- Delete confirmation -->
    <AdminDeleteConfirm
      v-if="confirmDeleteRoom"
      v-model="confirmDeleteRoomOpen"
      title="Delete room"
      :message="`Are you sure you want to delete ${confirmDeleteRoom?.name}? All associated bookings will be affected.`"
      confirm-text="Delete room"
      @confirm="deleteRoom"
      @cancel="confirmDeleteRoom = null" />
  </div>
</template>

<script setup lang="ts">
import { Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Rooms'
pageSubtitle.value = 'Manage meeting rooms and availability'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const { getMeetingDays } = useTemporal()

const loading = ref(true)
const saving = ref(false)
const rooms = ref<any[]>([])
const selectedRoom = ref<any>(null)
const roomBookings = ref<any[]>([])
const roomModalOpen = ref(false)
const editingRoom = ref<any>(null)
const confirmDeleteRoom = ref<any>(null)
const confirmDeleteRoomOpen = computed({
  get: () => !!confirmDeleteRoom.value,
  set: (v) => {
    if (!v) confirmDeleteRoom.value = null
  }
})

const ROOM_COLORS = [
  { name: 'sky', hex: '#38bdf8' },
  { name: 'yellow', hex: '#fbbf24' },
  { name: 'purple', hex: '#a78bfa' },
  { name: 'emerald', hex: '#34d399' },
  { name: 'indigo', hex: '#818cf8' }
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Day headers for the availability editor: weekday name + the matching date
// number (e.g. "Mon 20") from the viewing meeting's week, falling back to plain
// weekday names when no meeting/date is available.
const availabilityDays = computed(() => {
  const m = meetingStore.viewingMeeting
  if (m?.startDate) {
    try {
      return getMeetingDays(m).map((d, i) => {
        const [name, num] = d.label.split(' ')
        return { key: i, name, num }
      })
    } catch {
      // fall through to plain labels
    }
  }
  return DAY_LABELS.map((name, i) => ({ key: i, name, num: '' }))
})

const TIME_OPTIONS = (() => {
  const opts = []
  for (let m = 7 * 60; m <= 23 * 60 + 45; m += 15) {
    const h = Math.floor(m / 60)
    const min = m % 60
    const label = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    opts.push({ value: m, label })
  }
  return opts
})()

const roomForm = reactive({
  name: '',
  capacity: 20,
  color: 'sky',
  description: '',
  videoLinkName: 'Webex',
  videoLinkUrl: '',
  availability: [[], [], [], [], []] as { s: number; e: number }[][]
})

function roomColorHex(colorName: string) {
  return ROOM_COLORS.find((c) => c.name === colorName)?.hex || '#2dd4bf'
}

// Total weekly availability window for a room, in minutes (falls back to the
// server value when present).
function roomWindowMinutes(room: any) {
  if (typeof room.windowMinutes === 'number') return room.windowMinutes
  const avail = Array.isArray(room.availability) ? room.availability : []
  let total = 0
  for (const day of avail) {
    if (Array.isArray(day)) {
      for (const p of day) total += Math.max(0, (p.e ?? 0) - (p.s ?? 0))
    }
  }
  return total
}

function clampPct(part: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, (part / total) * 100))
}

// Minutes still bookable (server-computed, buffer- and min-length-aware).
function roomBookableFree(room: any) {
  return (
    room.bookableFreeMinutes ?? Math.max(0, roomWindowMinutes(room) - (room.bookedMinutes ?? 0))
  )
}

// Free hours that can still actually be booked.
function roomFreeHours(room: any) {
  return Math.round((roomBookableFree(room) / 60) * 10) / 10
}

// Bar segments: teal = booked, orange = unallocatable (buffers + gaps too small).
function roomBookedPct(room: any) {
  return clampPct(room.bookedMinutes ?? 0, roomWindowMinutes(room))
}
function roomBlockedPct(room: any) {
  const total = roomWindowMinutes(room)
  const blocked = Math.max(0, total - (room.bookedMinutes ?? 0) - roomBookableFree(room))
  return clampPct(blocked, total)
}

// Headline utilization = everything that can no longer be booked.
function roomUtilizationPct(room: any) {
  const total = roomWindowMinutes(room)
  if (!total) return 0
  return Math.round(clampPct(total - roomBookableFree(room), total))
}

function openAddRoom() {
  editingRoom.value = null
  Object.assign(roomForm, {
    name: '',
    capacity: 20,
    color: 'sky',
    description: '',
    videoLinkName: 'Webex',
    videoLinkUrl: '',
    availability: [[], [], [], [], []]
  })
  roomModalOpen.value = true
}

function openEditRoom(room: any) {
  editingRoom.value = room
  const avail =
    Array.isArray(room.availability) && room.availability.length === 5
      ? JSON.parse(JSON.stringify(room.availability))
      : [[], [], [], [], []]
  Object.assign(roomForm, {
    name: room.name,
    capacity: room.capacity,
    color: room.color || 'sky',
    description: room.description || '',
    videoLinkName: room.videoLinkName || 'Webex',
    videoLinkUrl: room.videoLinkUrl || '',
    availability: avail
  })
  roomModalOpen.value = true
}

function addPeriod(dayKey: number) {
  if (!Array.isArray(roomForm.availability[dayKey])) roomForm.availability[dayKey] = []
  roomForm.availability[dayKey].push({ s: 8 * 60, e: 20 * 60 })
}

function removePeriod(dayKey: number, pi: number) {
  roomForm.availability[dayKey]?.splice(pi, 1)
}

async function saveRoom() {
  if (!roomForm.description.trim()) {
    toast.show('Description is required', 'bad')
    return
  }
  saving.value = true
  try {
    const body = {
      ...roomForm,
      videoLinkUrl: roomForm.videoLinkUrl.trim() || null,
      videoLinkName: roomForm.videoLinkName.trim() || 'Webex'
    }
    if (editingRoom.value) {
      await useApiFetch(`/rooms/${editingRoom.value.id}`, {
        method: 'PUT',
        body
      })
      toast.show('Room updated', 'ok')
    } else {
      await useApiFetch(`/meetings/${meetingStore.viewingMeeting!.id}/rooms`, {
        method: 'POST',
        body
      })
      toast.show('Room added', 'ok')
    }
    roomModalOpen.value = false
    await loadRooms()
  } catch {
    toast.show('Failed to save room', 'bad')
  } finally {
    saving.value = false
  }
}

async function deleteRoom() {
  const roomToDelete = confirmDeleteRoom.value
  try {
    await useApiFetch(`/rooms/${roomToDelete.id}`, { method: 'DELETE' })
    toast.show('Room deleted', 'ok')
    if (selectedRoom.value?.id === roomToDelete.id) selectedRoom.value = null
    confirmDeleteRoom.value = null
    await loadRooms()
  } catch {
    toast.show('Failed to delete room', 'bad')
  }
}

async function loadRooms() {
  if (!meetingStore.viewingMeeting) return
  loading.value = true
  try {
    rooms.value = await useApiFetch(`/meetings/${meetingStore.viewingMeeting.id}/rooms`)
    if (!selectedRoom.value && rooms.value.length) {
      selectedRoom.value = rooms.value[0]
    }
  } catch {
    toast.show('Failed to load rooms', 'bad')
  } finally {
    loading.value = false
  }
}

async function loadBookings() {
  if (!meetingStore.viewingMeeting) return
  try {
    roomBookings.value = await useApiFetch(`/meetings/${meetingStore.viewingMeeting.id}/bookings`)
  } catch {
    // ignore
  }
}

watch(
  () => meetingStore.viewingMeeting?.id,
  () => {
    loadRooms()
    loadBookings()
  }
)

onMounted(async () => {
  await meetingStore.fetchMeetings()
  await Promise.all([loadRooms(), loadBookings()])
})
</script>
