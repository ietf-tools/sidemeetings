<template>
  <div>
    <!-- Progress indicator -->
    <div class="flex items-center justify-center gap-0 mb-8">
      <template v-for="(label, i) in STEPS" :key="i">
        <div class="flex flex-col items-center">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
            :class="step > i + 1 ? 'bg-ok text-[#022c1c]' : step === i + 1 ? 'bg-accent text-accent-text' : 'bg-s2 text-text-dim border border-border-strong'"
          >
            <Check v-if="step > i + 1" class="w-3.5 h-3.5" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="text-[10px] mt-1 font-medium" :class="step === i + 1 ? 'text-accent' : 'text-text-faint'">{{ label }}</span>
        </div>
        <div v-if="i < STEPS.length - 1" class="w-12 h-px mt-[-12px] mx-1" :class="step > i + 1 ? 'bg-ok' : 'bg-border-strong'"></div>
      </template>
    </div>

    <!-- Step 1: Choose a room -->
    <div v-if="step === 1">
      <h2 class="text-xl font-bold text-text mb-1">Choose a room</h2>
      <p class="text-sm text-text-dim mb-6">Select a room for your side meeting</p>
      <div v-if="loadingMeeting" class="py-16 text-center text-text-dim">Loading…</div>
      <div v-else-if="!activeMeeting" class="py-16 text-center text-text-dim">
        No active meeting. Please check back later.
      </div>
      <div v-else>
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));">
          <div
            v-for="room in rooms"
            :key="room.id"
            class="card p-5 cursor-pointer transition-all hover:border-accent/40"
            :class="selectedRoom?.id === room.id ? 'border-accent/60' : ''"
            :style="selectedRoom?.id === room.id ? 'box-shadow: inset 0 0 0 1px rgba(45,212,191,.5), inset 0 0 26px rgba(45,212,191,.22), var(--shadow);' : ''"
            @click="selectedRoom = room; step = 2"
          >
            <div class="flex items-center gap-2.5 mb-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ background: roomColorHex(room.color) }"></div>
              <h3 class="font-semibold text-text">{{ room.name }}</h3>
            </div>
            <p class="text-xs text-text-dim mb-4 leading-relaxed min-h-[2.5rem]">{{ room.description || 'No description' }}</p>
            <div class="flex items-center justify-between text-xs text-text-faint pt-3 border-t border-border">
              <span class="flex items-center gap-1.5">
                <Users class="w-3.5 h-3.5" />
                <span class="text-text-dim">capacity</span>
                <span class="font-bold text-text">{{ room.capacity }}</span>
              </span>
              <span>Floor {{ room.floor || '?' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 2: Pick a time -->
    <div v-else-if="step === 2">
      <div class="flex items-center gap-3 mb-4">
        <button class="btn-secondary text-xs py-1.5 px-3" @click="step = 1">
          <ArrowLeft class="w-3.5 h-3.5" /> Back
        </button>
        <div>
          <h2 class="text-xl font-bold text-text">Pick a time</h2>
          <p class="text-xs text-text-dim mt-0.5">
            All times are in the <strong class="text-text">{{ activeMeeting?.timezone }}</strong> timezone
          </p>
        </div>
      </div>
      <p class="text-sm text-text-dim mb-4">Pick any open slot below</p>

      <!-- Duration selector -->
      <div class="mb-5">
        <label class="form-label">Side meeting length</label>
        <div class="flex items-center gap-2">
          <button
            v-for="d in [60, 90, 120]"
            :key="d"
            class="btn text-sm py-2 px-4"
            :class="duration === d ? 'btn-primary' : 'btn-secondary'"
            @click="duration = d"
          >{{ d }} min</button>
        </div>
      </div>

      <!-- Day grid -->
      <div v-if="loadingSlots" class="py-8 text-center text-text-dim">Loading availability…</div>
      <div v-else class="overflow-x-auto">
        <div class="grid gap-3 min-w-[640px]" :style="`grid-template-columns: repeat(${meetingDays.length}, 1fr);`">
          <div v-for="day in meetingDays" :key="day.date" class="min-w-0">
            <div class="text-center mb-2">
              <div class="text-xs font-semibold text-text-dim uppercase tracking-wider">{{ day.label.split(' ')[0] }}</div>
              <div class="font-mono text-sm text-text">{{ day.label.split(' ')[1] }}</div>
            </div>
            <div class="space-y-1">
              <button
                v-for="slot in getAvailableSlots(day)"
                :key="slot.value"
                class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors"
                :class="slot.available ? 'bg-s2 hover:bg-accent-weak hover:border-accent/40 border border-border-strong text-text' : 'opacity-40 cursor-not-allowed bg-s2 border border-border text-text-dim'"
                :disabled="!slot.available"
                @click="slot.available && selectSlot(day, slot)"
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0" :class="slot.available ? 'bg-ok' : 'bg-bad'"></span>
                <span class="font-mono">{{ slot.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: Details -->
    <div v-else-if="step === 3">
      <div class="flex items-center gap-3 mb-6">
        <button class="btn-secondary text-xs py-1.5 px-3" @click="step = 2">
          <ArrowLeft class="w-3.5 h-3.5" /> Back
        </button>
        <h2 class="text-xl font-bold text-text">Meeting details</h2>
      </div>

      <div class="space-y-5">
        <!-- Organizer (read-only) -->
        <div class="card p-5">
          <h3 class="text-sm font-semibold text-text mb-3">Organizer</h3>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
              style="background: linear-gradient(135deg, #2dd4bf 0%, #0891b2 100%); color: #04241f;">
              {{ userInitials }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-text">{{ auth.user?.name }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-medium">You</span>
              </div>
              <div class="text-xs text-text-dim font-mono">{{ auth.user?.email }}</div>
            </div>
          </div>
        </div>

        <!-- Title + Description -->
        <div class="card p-5 space-y-4">
          <div>
            <label class="form-label">Title *</label>
            <input v-model="details.title" type="text" class="form-input" placeholder="Side meeting title" required />
          </div>
          <div>
            <label class="form-label">Description *</label>
            <textarea v-model="details.description" rows="4" class="form-input resize-none" placeholder="What will this meeting cover?" required></textarea>
          </div>
        </div>

        <!-- Meeting type + Areas -->
        <div class="card p-5">
          <label class="form-label mb-3">Meeting type</label>
          <div class="flex items-center gap-2 mb-4">
            <button class="btn py-1.5 px-4" :class="!details.isIrtf ? 'btn-primary' : 'btn-secondary'" @click="details.isIrtf = false">IETF</button>
            <button class="btn py-1.5 px-4" :class="details.isIrtf ? 'btn-primary' : 'btn-secondary'" @click="details.isIrtf = true">IRTF</button>
          </div>
          <div v-if="!details.isIrtf">
            <label class="form-label">Area (select all that apply)</label>
            <AdminAreaChips v-model="details.areas" />
          </div>
        </div>

        <!-- Video -->
        <div class="card p-5">
          <label class="form-label">Custom video tool link</label>
          <input v-model="details.videoLink" type="url" class="form-input" placeholder="Leave blank to use the IETF-provided Webex tool" />
        </div>

        <!-- Co-organizers -->
        <div class="card p-5">
          <h3 class="text-sm font-semibold text-text mb-3">Additional co-organizers <span class="text-text-faint font-normal">(optional)</span></h3>
          <div v-if="details.coOrganizers.length" class="flex flex-wrap gap-2 mb-3">
            <div v-for="(co, i) in details.coOrganizers" :key="i"
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
              style="background: #1a2029; border: 1px solid #272f3b;">
              <span class="text-text">{{ co.name }}</span>
              <span class="text-text-dim font-mono">{{ co.email }}</span>
              <button class="text-text-faint hover:text-bad transition-colors" @click="details.coOrganizers.splice(i, 1)">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
          <div class="flex gap-2">
            <input v-model="newCoName" type="text" class="form-input" placeholder="Name" />
            <input v-model="newCoEmail" type="email" class="form-input font-mono text-xs" placeholder="Email" />
            <button class="btn-secondary flex-shrink-0" @click="addCo">Add</button>
          </div>
        </div>

        <!-- Note Well + Agreement -->
        <div class="card p-5">
          <div class="text-xs text-text-dim leading-relaxed mb-4 p-4 rounded-lg" style="background: #1a2029;">
            <p class="mb-2">
              I agree to follow IETF processes and policies, a reminder of which is given in the
              <a href="https://www.ietf.org/about/note-well/" target="_blank" class="text-accent hover:underline">IETF Note Well</a>,
              and in doing so I consent to the use of my information in accordance with the
              <a href="https://www.ietf.org/privacy-statement/" target="_blank" class="text-accent hover:underline">IETF/IRTF/IAB Privacy Statement</a>.
            </p>
            <p>
              For more information: <a href="https://www.ietf.org/meeting/side-meetings/" target="_blank" class="text-accent hover:underline">https://www.ietf.org/meeting/side-meetings/</a>
            </p>
          </div>
          <div class="flex items-start gap-3">
            <input id="agree" v-model="details.agreed" type="checkbox" class="w-4 h-4 mt-0.5 accent-accent flex-shrink-0" />
            <label for="agree" class="text-sm text-text cursor-pointer leading-relaxed">
              I have read and agree to the IETF Note Well and privacy statement above
            </label>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            class="btn-primary py-2.5 px-6 text-base"
            :disabled="!canSubmit || submitting"
            @click="submit"
          >
            {{ submitting ? 'Submitting…' : 'Submit request' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Step 4: Confirmation -->
    <div v-else-if="step === 4" class="text-center">
      <div class="w-16 h-16 rounded-full bg-ok/20 flex items-center justify-center mx-auto mb-5">
        <CheckCircle class="w-9 h-9 text-ok" />
      </div>
      <h2 class="text-2xl font-bold text-text mb-2">Request submitted!</h2>
      <p class="text-sm text-text-dim mb-2">
        You'll receive a confirmation email shortly.
      </p>
      <p class="text-xs text-text-faint mb-8">
        Co-organizers listed on this meeting will also receive a notification.
      </p>

      <!-- Summary card -->
      <div class="card p-6 text-left max-w-md mx-auto mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-text">{{ submitted?.title }}</h3>
          <AdminStatusBadge state="pending" />
        </div>
        <div class="space-y-3 text-sm">
          <div class="flex items-start gap-3">
            <div class="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" :style="{ background: roomColorHex(selectedRoom?.color) }"></div>
            <div>
              <div class="text-text-dim text-xs mb-0.5">Room</div>
              <div class="text-text">{{ selectedRoom?.name }}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <Clock class="w-3.5 h-3.5 text-text-dim mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-text-dim text-xs mb-0.5">When</div>
              <div class="text-text">{{ selectedDay?.label }}</div>
              <div class="text-text-dim font-mono text-xs">
                {{ minutesToTime(selectedStartsAt) }}–{{ minutesToTime(selectedStartsAt + duration) }}
                <span class="text-text-faint"> ({{ activeMeeting?.timezone }})</span>
              </div>
            </div>
          </div>
          <div v-if="details.videoLink || true" class="flex items-start gap-3">
            <Video class="w-3.5 h-3.5 text-text-dim mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-text-dim text-xs mb-0.5">Video</div>
              <div class="text-text text-xs font-mono">{{ details.videoLink || 'IETF Webex (provided)' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-3">
        <a href="https://www.ietf.org/meeting/side-meetings/" target="_blank" class="btn-primary py-2 px-5">
          View side meetings
        </a>
        <button class="btn-secondary py-2 px-5" @click="resetWizard">
          Request another side meeting
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Check, CheckCircle, Users, X, Clock, Video } from 'lucide-vue-next'

definePageMeta({ layout: 'request', middleware: ['auth'] })

const auth = useAuthStore()
const toast = useToastStore()
const { minutesToTime, getMeetingDays } = useTemporal()

const STEPS = ['Choose room', 'Pick time', 'Details', 'Confirm']

const ROOM_COLORS: Record<string, string> = {
  sky: '#38bdf8', yellow: '#fbbf24', purple: '#a78bfa', emerald: '#34d399', indigo: '#818cf8',
}

function roomColorHex(name?: string) {
  return name ? (ROOM_COLORS[name] || '#2dd4bf') : '#2dd4bf'
}

const step = ref(1)
const loadingMeeting = ref(true)
const loadingSlots = ref(false)
const submitting = ref(false)

const activeMeeting = ref<any>(null)
const rooms = ref<any[]>([])
// slots: { [dayOffset]: minuteValues[] } from backend
const slots = ref<Record<number, number[]>>({})

const selectedRoom = ref<any>(null)
const selectedDay = ref<any>(null)
const selectedStartsAt = ref(0)
const duration = ref(60)

const newCoName = ref('')
const newCoEmail = ref('')
const submitted = ref<any>(null)

const details = reactive({
  title: '',
  description: '',
  isIrtf: false,
  areas: [] as string[],
  videoLink: '',
  coOrganizers: [] as { name: string; email: string }[],
  agreed: false,
})

const userInitials = computed(() => {
  return (auth.user?.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
})

const meetingDays = computed(() => {
  if (!activeMeeting.value) return []
  return getMeetingDays(activeMeeting.value)
})

const canSubmit = computed(() =>
  details.title.trim() && details.description.trim() && details.agreed
)

function getAvailableSlots(day: { offset: number }) {
  return (slots.value[day.offset] || []).map((m: number) => ({
    value: m,
    label: minutesToTime(m),
    available: true,
  }))
}

async function fetchSlots() {
  if (!selectedRoom.value) return
  loadingSlots.value = true
  try {
    const data = await useApiFetch<{ slots: Record<number, number[]> }>(
      `/public/rooms/${selectedRoom.value.id}/slots?duration=${duration.value}`
    )
    slots.value = data.slots
  } catch {
    slots.value = {}
  } finally {
    loadingSlots.value = false
  }
}

function selectSlot(day: any, slot: { value: number }) {
  selectedDay.value = day
  selectedStartsAt.value = slot.value
  step.value = 3
}

function addCo() {
  if (newCoName.value && newCoEmail.value) {
    details.coOrganizers.push({ name: newCoName.value, email: newCoEmail.value })
    newCoName.value = ''
    newCoEmail.value = ''
  }
}

async function submit() {
  submitting.value = true
  try {
    // Convert selected date + minutes to an ISO timestamp in the meeting timezone
    const tz = activeMeeting.value.timezone || 'UTC'
    const date = Temporal.PlainDate.from(selectedDay.value.date)
    const dt = date.toPlainDateTime({ hour: Math.floor(selectedStartsAt.value / 60), minute: selectedStartsAt.value % 60 })
    const startsAt = dt.toZonedDateTime(tz).toInstant().toString()

    const result = await useApiFetch(`/meetings/${activeMeeting.value.id}/bookings`, {
      method: 'POST',
      body: {
        roomId: selectedRoom.value.id,
        startsAt,
        duration: duration.value,
        title: details.title,
        description: details.description,
        isIrtf: details.isIrtf,
        areas: details.isIrtf ? [] : details.areas,
        videoLinkUrl: details.videoLink || null,
        coOrganizers: details.coOrganizers,
      },
    })
    submitted.value = result
    step.value = 4
  } catch {
    toast.show('Failed to submit request. Please try again.', 'bad')
  } finally {
    submitting.value = false
  }
}

function resetWizard() {
  step.value = 1
  selectedRoom.value = null
  selectedDay.value = null
  selectedStartsAt.value = 0
  duration.value = 60
  Object.assign(details, {
    title: '', description: '', isIrtf: false, areas: [], videoLink: '', coOrganizers: [], agreed: false,
  })
  submitted.value = null
}

onMounted(async () => {
  try {
    const meeting = await useApiFetch<any>('/public/meetings/active')
    activeMeeting.value = meeting
    rooms.value = await useApiFetch<any[]>(`/public/meetings/${meeting.id}/rooms`).catch(() => [])
  } catch {
    // no active meeting
  } finally {
    loadingMeeting.value = false
  }
})

watch([() => selectedRoom.value?.id, duration], () => {
  if (selectedRoom.value) fetchSlots()
})
</script>
