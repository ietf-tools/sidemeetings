<template>
  <!-- Top bar -->
  <header class="w-full max-w-[960px] flex items-center justify-between gap-3 gap-y-3 flex-wrap pt-6 pb-1 px-0.5">
    <NuxtLink to="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
      <div class="w-[34px] h-[34px] rounded-[9px] bg-accent text-accent-text flex items-center justify-center font-extrabold text-[15px] tracking-tight">SM</div>
      <div>
        <div class="font-bold text-sm text-text leading-tight">Side Meetings</div>
        <div class="text-[11px] text-text-faint font-medium">Request a room</div>
      </div>
    </NuxtLink>
    <div v-if="activeMeeting" class="flex items-center gap-2.5 bg-surface border border-border rounded-[11px] px-3 py-2">
      <div class="w-[30px] h-[30px] rounded-lg bg-accent-weak text-accent flex items-center justify-center font-bold text-xs font-mono flex-shrink-0">{{ activeMeeting.num }}</div>
      <div>
        <div class="text-[13px] font-bold text-text leading-tight">{{ meetingLabel(activeMeeting.num) }}</div>
        <div class="text-[11px] text-text-dim">{{ activeMeeting.city }}, {{ activeMeeting.country }}</div>
      </div>
    </div>
  </header>

  <!-- Stepper -->
  <div class="w-full max-w-[680px] flex items-center py-6 sm:py-7">
    <template v-for="(label, i) in STEPS" :key="i">
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-[12.5px] font-bold flex-shrink-0 border transition-all"
          :class="i <= stepIndex ? 'bg-accent text-accent-text border-accent' : 'bg-s2 text-text-faint border-border'">
          <Check v-if="i < stepIndex" class="w-3.5 h-3.5" :stroke-width="3" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <!-- Full labels on larger screens; only the active step's label on mobile -->
        <div
          class="text-[12.5px] whitespace-nowrap truncate"
          :class="[
            i === stepIndex ? 'font-bold text-text' : i < stepIndex ? 'font-semibold text-text-dim' : 'font-semibold text-text-faint',
            i === stepIndex ? '' : 'hidden sm:block',
          ]">
          {{ label }}
        </div>
      </div>
      <div
        v-if="i < STEPS.length - 1"
        class="flex-1 h-0.5 min-w-[12px] mx-2 sm:mx-3 rounded-sm"
        :class="i < stepIndex ? 'bg-accent' : 'bg-border'"></div>
    </template>
  </div>

  <!-- Step 1: Choose a room -->
  <div v-if="step === 1" class="w-full max-w-[960px]">
    <div class="text-center mb-6">
      <h1 class="text-[26px] font-extrabold text-text tracking-tight">Choose a room</h1>
      <p class="text-sm text-text-dim mt-1.5">
        Pick the space that fits your side meeting. You'll choose a time next.
      </p>
    </div>
    <div v-if="loadingMeeting" class="py-16 text-center text-text-dim">Loading…</div>
    <div v-else-if="!activeMeeting" class="py-16 text-center text-text-dim">
      No active meeting. Please check back later.
    </div>
    <div v-else class="flex flex-wrap justify-center gap-4">
      <div v-for="room in rooms" :key="room.id" class="group relative w-full sm:w-[300px]">
        <span
          v-if="!isRoomAvailable(room)"
          class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 rounded-lg bg-s3 border border-border-strong text-text text-xs font-medium text-center max-w-[220px] w-max opacity-0 group-hover:opacity-100 transition-opacity shadow-card z-20">
          This room is fully booked and no longer available
        </span>
        <button
          class="w-full h-full text-left bg-surface border border-border rounded-2xl shadow-card p-[18px] flex flex-col transition-all"
          :class="isRoomAvailable(room) ? 'hover:border-accent hover:-translate-y-[3px]' : 'opacity-50 cursor-not-allowed'"
          :style="
            !isRoomAvailable(room)
              ? 'background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0, rgba(255,255,255,.05) 1px, transparent 1px, transparent 7px);'
              : ''
          "
          @click="selectRoom(room)">
          <div class="text-base font-bold text-text flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: roomColorHex(room.color) }"></span>
            {{ room.name }}
          </div>
          <div class="text-[13px] text-text-dim mt-2.5 leading-relaxed flex-1">
            {{ room.description || 'No description' }}
          </div>
          <div class="flex items-center justify-between mt-4 pt-3.5 border-t border-border">
            <span class="text-[12.5px] text-text-faint flex items-center gap-1.5">
              <Users class="w-3.5 h-3.5" /> capacity <b class="font-bold text-text">{{ room.capacity }}</b>
            </span>
            <span
              v-if="isRoomAvailable(room)"
              class="text-[13px] font-bold text-accent flex items-center gap-1.5">
              Select <ArrowRight class="w-3.5 h-3.5" />
            </span>
            <span v-else class="text-[12.5px] font-semibold text-text-faint">Fully booked</span>
          </div>
        </button>
      </div>
    </div>
  </div>

  <!-- Step 2: Pick a time -->
  <div v-else-if="step === 2" class="w-full max-w-[960px]">
    <button
      class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-dim hover:text-text mb-4 transition-colors"
      @click="step = 1">
      <ChevronLeft class="w-4 h-4" /> Choose a different room
    </button>

    <div class="card overflow-hidden !rounded-2xl">
      <!-- Room header -->
      <div class="px-5 py-[18px] border-b border-border">
        <div class="flex items-center gap-2.5 text-[17px] font-bold text-text flex-wrap">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: roomColorHex(selectedRoom?.color) }"></span>
          {{ selectedRoom?.name }}
          <span class="inline-flex items-center gap-1.5 text-[12.5px] text-text-faint font-medium border border-border rounded-full px-2.5 py-0.5">
            <Users class="w-3.5 h-3.5" /> capacity <b class="font-bold text-text">{{ selectedRoom?.capacity }}</b>
          </span>
        </div>
        <div class="text-[12.5px] text-text-dim mt-1.5 leading-relaxed">{{ selectedRoom?.description }}</div>
      </div>

      <!-- Duration toggle -->
      <div class="px-5 py-4 border-b border-border bg-s2 flex items-center gap-3.5 flex-wrap">
        <div class="text-[12.5px] font-semibold text-text-dim">Side Meeting length</div>
        <div class="flex gap-2">
          <button
            v-for="d in [60, 90, 120]"
            :key="d"
            class="px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-colors"
            :class="duration === d ? 'bg-accent text-accent-text border-accent' : 'bg-surface text-text-dim border-border-strong hover:text-text'"
            @click="duration = d">
            {{ d }} min
          </button>
        </div>
        <div class="flex-1"></div>
        <div class="text-xs text-right leading-relaxed">
          <span class="text-text">All times are in the <b class="font-bold">{{ activeMeeting?.timezone }}</b> timezone</span><br>
          <span class="text-text-faint">Pick any open slot below</span>
        </div>
      </div>

      <!-- Day columns -->
      <div v-if="loadingSlots" class="py-10 text-center text-text-dim text-sm">Loading availability…</div>
      <div v-else class="overflow-x-auto">
        <div class="grid min-w-[760px]" :style="`grid-template-columns: repeat(${meetingDays.length}, minmax(150px, 1fr));`">
          <div
            v-for="(day, di) in meetingDays"
            :key="day.date"
            class="px-3 py-4"
            :class="di < meetingDays.length - 1 ? 'border-r border-s3' : ''">
            <div class="text-center pb-3 border-b border-s3 mb-3">
              <div class="text-[13px] font-bold text-text">{{ day.label.split(' ')[0] }}</div>
              <div class="text-xs text-text-faint font-mono">{{ day.label.split(' ')[1] }}</div>
            </div>
            <div v-if="getAvailableSlots(day).length" class="flex flex-col gap-1.5">
              <button
                v-for="slot in getAvailableSlots(day)"
                :key="slot.value"
                class="w-full px-2.5 py-2 rounded-lg text-[12.5px] font-semibold font-mono bg-s2 text-text border border-border-strong flex items-center justify-center gap-2 transition-colors hover:bg-accent-weak hover:border-accent"
                @click="selectSlot(day, slot)">
                <span class="w-[7px] h-[7px] rounded-full bg-ok flex-shrink-0"></span>
                {{ slot.label }}–{{ minutesToTime(slot.value + duration) }}
              </button>
            </div>
            <div v-else class="text-center text-xs text-text-faint py-5">No open {{ duration }} min slots</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Step 3: Details -->
  <div v-else-if="step === 3" class="w-full max-w-[680px]">
    <button
      class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-dim hover:text-text mb-4 transition-colors"
      @click="step = 2">
      <ChevronLeft class="w-4 h-4" /> Pick a different time
    </button>

    <!-- Selected slot banner -->
    <div
      class="flex items-center gap-3.5 px-[18px] py-[15px] rounded-[13px] bg-accent-weak mb-5 border"
      style="border-color: color-mix(in srgb, var(--accent) 40%, transparent)">
      <div class="w-10 h-10 rounded-[10px] flex-shrink-0 bg-accent text-accent-text flex items-center justify-center">
        <Calendar class="w-5 h-5" />
      </div>
      <div>
        <div class="text-[15px] font-bold text-text">
          {{ selectedDay?.label }} · {{ minutesToTime(selectedStartsAt) }}–{{ minutesToTime(selectedStartsAt + duration) }}
          <span class="font-medium text-text-dim">({{ activeMeeting?.timezone }})</span>
        </div>
        <div class="text-[12.5px] text-text-dim">{{ selectedRoom?.name }}</div>
      </div>
    </div>

    <div class="card p-6 flex flex-col gap-[18px] !rounded-2xl">
      <!-- Organizer -->
      <div>
        <label class="form-label">Organizer</label>
        <div class="flex items-center gap-2.5 bg-s2 border border-border rounded-lg pl-3.5 pr-2 py-2.5">
          <div class="w-7 h-7 rounded-full flex-shrink-0 bg-accent text-accent-text flex items-center justify-center font-bold text-xs">{{ userInitials }}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-semibold text-text flex items-center gap-1.5">
              {{ auth.user?.name }}
              <span class="text-[10px] font-bold text-accent bg-accent-weak px-1.5 py-px rounded">You</span>
            </div>
            <div class="text-xs text-text-dim font-mono truncate">{{ auth.user?.email }}</div>
          </div>
        </div>
      </div>

      <div>
        <label class="form-label">Title <span class="text-bad">*</span></label>
        <input v-model="details.title" type="text" class="form-input" placeholder="e.g. DNSOP Hackathon Sync" required />
      </div>
      <div>
        <label class="form-label">Description <span class="text-bad">*</span></label>
        <textarea v-model="details.description" rows="3" class="form-input resize-y leading-relaxed" placeholder="What is this side meeting about?" required></textarea>
      </div>

      <!-- Meeting type -->
      <div>
        <label class="form-label">Meeting type</label>
        <div class="flex gap-2.5">
          <button
            class="flex-1 px-4 py-3 rounded-lg border text-[13.5px] font-bold transition-colors"
            :class="!details.isIrtf ? 'bg-accent-weak text-accent border-accent' : 'bg-surface text-text-dim border-border-strong hover:text-text'"
            @click="details.isIrtf = false">
            IETF side meeting
          </button>
          <button
            class="flex-1 px-4 py-3 rounded-lg border text-[13.5px] font-bold transition-colors"
            :class="details.isIrtf ? 'bg-accent-weak text-accent border-accent' : 'bg-surface text-text-dim border-border-strong hover:text-text'"
            @click="details.isIrtf = true">
            IRTF side meeting
          </button>
        </div>
      </div>

      <!-- Areas -->
      <div v-if="!details.isIrtf">
        <label class="form-label">
          IETF area(s) <span class="text-text-faint font-normal">· optional · select one or more</span>
        </label>
        <AdminAreaChips v-model="details.areas" />
      </div>

      <!-- Custom video -->
      <div>
        <label class="form-label">Custom video tool link <span class="text-text-faint font-normal">· optional</span></label>
        <input v-model="details.videoLink" type="url" class="form-input font-mono text-xs" placeholder="https://…" />
        <div class="text-[11.5px] text-text-faint mt-1.5">
          If left empty, a Webex meeting link will be created for you.
        </div>
      </div>

      <!-- Co-organizers -->
      <div>
        <label class="form-label">Additional co-organizers <span class="text-text-faint font-normal">· optional</span></label>
        <div v-if="details.coOrganizers.length" class="flex flex-col gap-2 mb-2.5">
          <div
            v-for="(co, i) in details.coOrganizers"
            :key="i"
            class="flex items-center gap-2.5 rounded-lg bg-s2 border border-border pl-3.5 pr-2 py-2">
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-semibold text-text truncate">{{ co.name }}</div>
              <div v-if="co.email" class="text-xs text-text-dim font-mono truncate">{{ co.email }}</div>
            </div>
            <button
              type="button"
              title="Remove"
              class="w-6 h-6 flex-shrink-0 rounded-[7px] bg-s3 text-text-dim hover:text-bad flex items-center justify-center transition-colors"
              @click="details.coOrganizers.splice(i, 1)">
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="newCoName" type="text" class="form-input" placeholder="Name" @keydown.enter.prevent="addCo" />
          <input v-model="newCoEmail" type="email" class="form-input font-mono text-xs" placeholder="Email" @keydown.enter.prevent="addCo" />
          <button type="button" class="btn-secondary justify-center flex-shrink-0" @click="addCo">Add</button>
        </div>
      </div>

      <!-- Agreement -->
      <div
        class="flex items-start gap-3 px-[15px] py-[13px] border border-border-strong rounded-[10px] cursor-pointer bg-s2"
        @click="details.agreed = !details.agreed">
        <div
          class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border transition-colors"
          :class="details.agreed ? 'bg-accent border-accent' : 'bg-surface border-border-strong'">
          <Check v-if="details.agreed" class="w-3 h-3" :stroke-width="3" style="color: var(--accent-text)" />
        </div>
        <div class="text-xs text-text-dim leading-relaxed">
          I agree to follow IETF processes and policies, a reminder of which is given in the
          <a href="https://www.ietf.org/about/note-well/" target="_blank" class="text-accent" @click.stop>IETF Note Well</a>,
          and in doing so I consent to the use of my information in accordance with the
          <a href="https://www.ietf.org/privacy-statement/" target="_blank" class="text-accent" @click.stop>IETF/IRTF/IAB Privacy Statement</a>.
          I acknowledge that all organizers and attendees must be registered IETF participants; that side meetings
          must be open and free to all registered participants; and that any recording may occur only with the
          active consent of all participants.
          <div class="mt-2">
            For more information:
            <a href="https://www.ietf.org/meeting/side-meetings/" target="_blank" class="text-accent font-mono break-all" @click.stop>https://www.ietf.org/meeting/side-meetings/</a>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2.5 pt-[18px] border-t border-border">
        <button class="btn-secondary text-text-dim" @click="step = 2">Back</button>
        <button class="btn-primary" :disabled="!canSubmit || submitting" @click="submit">
          <ArrowRight class="w-4 h-4" /> {{ submitting ? 'Submitting…' : 'Submit request' }}
        </button>
      </div>
      <div v-if="!canSubmit" class="text-xs text-text-faint -mt-2 text-right">
        Fill in the title and description and accept the agreement to submit.
      </div>
    </div>
  </div>

  <!-- Step 4: Confirmation -->
  <div v-else-if="step === 4" class="w-full max-w-[600px]">
    <div class="text-center mb-6">
      <div class="w-16 h-16 rounded-full mx-auto mb-[18px] flex items-center justify-center" style="background: color-mix(in srgb, var(--ok) 18%, transparent); color: var(--ok);">
        <Check class="w-8 h-8" :stroke-width="2.6" />
      </div>
      <h1 class="text-[26px] font-extrabold text-text tracking-tight">Request submitted</h1>
      <p class="text-sm text-text-dim mt-2 leading-relaxed">
        Your side meeting request has been received and will be reviewed soon. We'll send an email to
        <span class="text-text font-semibold">{{ auth.user?.email }}</span> with the details. Once approved, your
        co-organizers will also receive the email.
      </p>
    </div>

    <div class="card p-[22px] !rounded-2xl">
      <div class="flex items-center justify-between mb-4">
        <div class="text-[15px] font-bold text-text">{{ submitted?.title }}</div>
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full text-warn border border-warn/30" style="background: color-mix(in srgb, var(--warn) 14%, transparent)">
          <span class="w-[7px] h-[7px] rounded-full bg-warn"></span> Pending review
        </span>
      </div>
      <div class="flex flex-col gap-3.5">
        <div>
          <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Room</p>
          <div class="text-[13.5px] font-semibold text-text mt-0.5">{{ selectedRoom?.name }}</div>
        </div>
        <div>
          <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">When</p>
          <div class="text-[13.5px] font-semibold text-text mt-0.5">
            {{ selectedDay?.label }} · {{ minutesToTime(selectedStartsAt) }}–{{ minutesToTime(selectedStartsAt + duration) }}
            <span class="font-medium text-text-faint">({{ activeMeeting?.timezone }})</span>
          </div>
        </div>
        <div>
          <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Video link</p>
          <div class="text-[12.5px] text-text-dim font-mono mt-0.5 break-all">{{ details.videoLink || 'IETF Webex (provided)' }}</div>
        </div>
        <div>
          <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Organizers</p>
          <div class="flex flex-col gap-1.5 mt-1.5">
            <div class="text-[13px]">
              <span class="font-semibold text-text">{{ auth.user?.name }}</span>
              <span class="text-text-dim font-mono text-xs ml-1">{{ auth.user?.email }}</span>
            </div>
            <div v-for="co in details.coOrganizers" :key="co.email" class="text-[13px]">
              <span class="font-semibold text-text">{{ co.name }}</span>
              <span class="text-text-dim font-mono text-xs ml-1">{{ co.email }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-center gap-2.5 mt-5 flex-wrap">
      <NuxtLink to="/" class="btn-primary">
        <Eye class="w-4 h-4" /> View side meetings
      </NuxtLink>
      <button class="btn-secondary" @click="resetWizard">
        <RotateCcw class="w-4 h-4" /> Request another side meeting
      </button>
    </div>
  </div>

  <!-- Cancel link (shown on every step) -->
  <div class="w-full max-w-[680px] text-center mt-8 mb-2">
    <NuxtLink to="/" class="text-xs text-text-faint hover:text-text-dim transition-colors">
      Cancel and return to side meetings
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { Check, Users, ArrowRight, ChevronLeft, Calendar, X, Eye, RotateCcw } from 'lucide-vue-next'

definePageMeta({ layout: 'request', middleware: ['auth'] })

const auth = useAuthStore()
const toast = useToastStore()
const { minutesToTime, getMeetingDays } = useTemporal()

const STEPS = ['Choose a room', 'Pick a time', 'Meeting details', 'Confirmation']

const ROOM_COLORS: Record<string, string> = {
  sky: '#38bdf8', yellow: '#fbbf24', purple: '#a78bfa', emerald: '#34d399', indigo: '#818cf8',
}

function roomColorHex(name?: string) {
  return name ? (ROOM_COLORS[name] || '#2dd4bf') : '#2dd4bf'
}

const step = ref(1)
const stepIndex = computed(() => step.value - 1)
const loadingMeeting = ref(true)
const loadingSlots = ref(false)
const submitting = ref(false)

const activeMeeting = ref<any>(null)
const rooms = ref<any[]>([])
// slots: { [dayOffset]: minuteValues[] } from backend
const slots = ref<Record<number, number[]>>({})
// roomId -> whether the room has any open slot left (at the minimum duration)
const roomAvailable = ref<Record<string, boolean>>({})

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

// A room counts as available until proven otherwise (avoids flashing every card
// as disabled before availability has loaded).
function isRoomAvailable(room: any) {
  return roomAvailable.value[room.id] !== false
}

function selectRoom(room: any) {
  if (!isRoomAvailable(room)) return
  selectedRoom.value = room
  step.value = 2
}

// Fetch slot availability for every room at the minimum duration (60 min): if a
// room has no 60-min slot, no longer one fits either, so it's fully booked.
async function loadRoomAvailability() {
  const entries = await Promise.all(
    rooms.value.map(async (r) => {
      try {
        const data = await useApiFetch<{ slots: Record<number, number[]> }>(
          `/public/rooms/${r.id}/slots?duration=60`
        )
        const hasSlot = Object.values(data.slots || {}).some((arr) => arr.length > 0)
        return [r.id, hasSlot] as const
      } catch {
        return [r.id, true] as const
      }
    })
  )
  roomAvailable.value = Object.fromEntries(entries)
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

// Whether the meeting is currently accepting side-meeting requests: between the
// submission open date and the end of the meeting (in the meeting's time zone).
function requestsOpen(m: any) {
  if (!m || !m.allowRequestsFrom) return false
  try {
    const now = Temporal.Now.instant()
    if (Temporal.Instant.compare(now, Temporal.Instant.from(m.allowRequestsFrom)) < 0) return false
    const endInstant = Temporal.PlainDate.from(m.endDate)
      .toZonedDateTime({ timeZone: m.timezone || 'UTC', plainTime: Temporal.PlainTime.from('23:59:59') })
      .toInstant()
    return Temporal.Instant.compare(now, endInstant) <= 0
  } catch {
    return false
  }
}

onMounted(async () => {
  try {
    const meeting = await useApiFetch<any>('/public/meetings/active')
    // Outside the submission window, only admins may proceed; everyone else is
    // sent to the public schedule.
    if (!requestsOpen(meeting) && !auth.isAdmin) {
      await navigateTo('/')
      return
    }
    activeMeeting.value = meeting
    rooms.value = await useApiFetch<any[]>(`/public/meetings/${meeting.id}/rooms`).catch(() => [])
    loadRoomAvailability()
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
