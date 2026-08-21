<template>
  <div class="max-w-[900px] mx-auto">
    <!-- Nothing has loaded yet: the first fetch runs on mount, so anything
         before it completes is "loading", not "empty". -->
    <div v-if="!loaded && !error" class="card px-5 py-16 text-center text-text-dim text-sm sm:px-8">Loading…</div>

    <div v-else-if="error && !loaded" class="card px-5 py-16 text-center sm:px-8">
      <div class="text-[15px] font-semibold text-text-dim">Couldn't load your side meetings</div>
      <div class="text-[13px] text-text-faint mt-1">{{ error }}</div>
      <button class="btn-secondary mt-4" :disabled="loading" @click="load(true)">
        {{ loading ? 'Retrying…' : 'Try again' }}
      </button>
    </div>

    <div v-else-if="!meeting" class="card px-5 py-16 text-center sm:px-8">
      <div class="text-[15px] font-semibold text-text-dim">No active meeting</div>
      <div class="text-[13px] text-text-faint mt-1">Please check back later.</div>
    </div>

    <div v-else-if="!items.length" class="card px-5 py-16 text-center sm:px-8">
      <div class="text-[15px] font-semibold text-text-dim">{{ emptyTitle }}</div>
      <div class="text-[13px] text-text-faint mt-1">{{ emptyHint }}</div>
    </div>

    <div v-else class="flex flex-col gap-3.5">
      <!-- A failed refresh keeps the last known data visible. -->
      <div
        v-if="error"
        class="rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad flex items-center justify-between gap-3 flex-wrap">
        <span>Couldn't refresh: {{ error }}</span>
        <button class="font-semibold underline" :disabled="loading" @click="load(true)">
          {{ loading ? 'Retrying…' : 'Retry' }}
        </button>
      </div>
      <div v-for="b in items" :key="b.id" class="card p-4 sm:p-[18px] !rounded-2xl">
        <!-- Header: title + status -->
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="text-[14.5px] sm:text-[15px] font-bold text-text flex items-center gap-2 flex-wrap break-words">
              {{ b.title }}
              <span
                v-if="b.isIrtf"
                class="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent-weak border border-accent/30 rounded-full px-2 py-px">
                IRTF
              </span>
              <span
                v-for="area in b.areas"
                :key="area"
                class="text-[10px] font-bold uppercase tracking-wide text-text-dim bg-s2 border border-border rounded-full px-2 py-px">
                {{ area }}
              </span>
            </div>
            <div class="text-[12.5px] text-text-dim mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  :style="{ background: roomColorHex(b.roomColor) }"></span>
                {{ b.roomName }}
              </span>
              <span class="text-text-faint">·</span>
              <span class="inline-flex items-center gap-1.5">
                <Users class="w-3.5 h-3.5" />
                {{ b.coOrganizers.length + 1 }}
                {{ b.coOrganizers.length ? 'organizers' : 'organizer' }}
              </span>
            </div>
          </div>
          <AdminStatusBadge :state="b.state" />
        </div>

        <!-- When -->
        <div class="mt-3.5 pt-3.5 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6 sm:flex-wrap">
          <div>
            <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">When</p>
            <div class="text-[13px] sm:text-[13.5px] font-semibold text-text mt-0.5">
              {{ when(b).day }}
              <span class="font-mono">{{ when(b).range }}</span>
              <span class="font-medium text-text-faint ml-1">({{ meeting.timezone }})</span>
            </div>
          </div>
          <div v-if="b.state === 'confirmed' && b.videoLinkUrl" class="min-w-0">
            <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">
              {{ b.videoLinkName || 'Video link' }}
            </p>
            <a
              :href="b.videoLinkUrl"
              target="_blank"
              rel="noopener"
              class="text-[12.5px] text-accent font-mono mt-0.5 break-all inline-block">
              {{ b.videoLinkUrl }}
            </a>
          </div>
        </div>

        <!-- Description -->
        <div v-if="b.description" class="mt-3.5 text-[13px] text-text-dim leading-relaxed whitespace-pre-line">
          {{ b.description }}
        </div>

        <!-- Description change awaiting review -->
        <div
          v-if="b.pendingDescription"
          class="mt-3.5 rounded-xl border border-warn/30 p-3.5"
          style="background: color-mix(in srgb, var(--warn) 8%, transparent)">
          <div class="flex items-center gap-2">
            <Hourglass class="w-3.5 h-3.5 text-warn flex-shrink-0" />
            <p class="text-[12px] font-bold text-warn">Description change awaiting approval</p>
          </div>
          <p class="text-[11.5px] text-text-dim mt-1">
            The description above stays published until an approver accepts your change.
          </p>
          <div class="mt-2.5 text-[13px] text-text leading-relaxed whitespace-pre-line">
            {{ b.pendingDescription }}
          </div>
          <button
            v-if="!hasStarted(b)"
            class="mt-2.5 text-[12px] font-semibold text-text-dim hover:text-text transition-colors"
            :disabled="busyId === b.id"
            @click="withdrawChange(b)">
            Withdraw change
          </button>
        </div>

        <!-- Co-organizers -->
        <div v-if="b.coOrganizers.length" class="mt-3.5">
          <p class="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Co-organizers</p>
          <div class="flex flex-col gap-1 mt-1.5">
            <div v-for="co in b.coOrganizers" :key="co.email" class="text-[13px]">
              <span class="font-semibold text-text">{{ co.name }}</span>
              <span class="text-text-dim font-mono text-xs ml-1.5">{{ co.email }}</span>
            </div>
          </div>
        </div>

        <!-- Footer: submitted date + actions (live requests only). Stacks on
             phones so the buttons get full-width, thumb-sized targets. -->
        <div
          class="mt-3.5 pt-3 border-t border-border flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:flex-wrap">
          <div class="text-[11.5px] text-text-faint">
            Submitted {{ formatSubmittedAt(b.createdAt, meeting.timezone) }}
          </div>
          <div
            v-if="(b.state === 'pending' || b.state === 'confirmed') && hasStarted(b)"
            class="text-[11.5px] text-text-faint">
            Already under way — contact support for changes
          </div>
          <div v-else-if="isEditable(b)" class="flex items-center gap-2">
            <button
              class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-border-strong bg-surface text-text text-[12px] font-semibold transition-colors hover:text-accent hover:border-accent disabled:opacity-40"
              :disabled="busyId === b.id"
              @click="openEdit(b)">
              <Pencil class="w-3.5 h-3.5 flex-shrink-0" /> Edit description
            </button>
            <button
              class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-bad/40 bg-bad/10 text-bad text-[12px] font-semibold transition-colors hover:border-bad hover:bg-bad/20 disabled:opacity-40"
              :disabled="busyId === b.id"
              @click="askCancel(b)">
              <X class="w-3.5 h-3.5 flex-shrink-0" />
              <!-- Full label where there's room (stacked phone rows, wide desktop);
                   shortened in the tablet range where both buttons share a line. -->
              <span class="sm:hidden lg:inline">Cancel side meeting</span>
              <span class="hidden sm:inline lg:hidden">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit description -->
    <AdminModal
      v-model="editOpen"
      title="Edit description"
      :subtitle="needsApproval ? 'Changes are reviewed before they go live' : 'Applied to your pending request right away'"
      size="lg">
      <div class="px-4 sm:px-6 py-5 flex flex-col gap-3.5">
        <div
          v-if="needsApproval"
          class="flex items-start gap-3 p-3.5 rounded-xl border border-warn/30"
          style="background: color-mix(in srgb, var(--warn) 8%, transparent)">
          <Hourglass class="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <p class="text-[12.5px] text-warn leading-relaxed font-medium">
            Your new description has to be approved by the IETF Secretariat. Until then the current
            description stays published on the schedule.
          </p>
        </div>
        <div
          v-else
          class="flex items-start gap-3 p-3.5 rounded-xl border border-border-strong bg-s2">
          <Info class="w-4 h-4 text-text-dim flex-shrink-0 mt-0.5" />
          <p class="text-[12.5px] text-text-dim leading-relaxed">
            This request is still awaiting review, so your new description takes effect immediately —
            the approver will see this version.
          </p>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea
            ref="editRef"
            v-model="editText"
            rows="5"
            class="form-input resize-none leading-relaxed overflow-y-auto"
            style="max-height: 320px; min-height: 120px"
            placeholder="What will this meeting cover?"
            @input="autoGrow"></textarea>
        </div>
        <div v-if="editing?.state === 'confirmed'" class="text-[12px] text-text-faint">
          Only the description can be changed. To move an approved side meeting to another room or
          time, cancel it and submit a new request.
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-border">
          <button class="btn-secondary text-text-dim" @click="editOpen = false">Cancel</button>
          <button class="btn-primary" :disabled="!canSubmitEdit" @click="submitEdit">
            {{ savingEdit ? 'Saving…' : needsApproval ? 'Submit for approval' : 'Save description' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- Cancel confirmation -->
    <AdminModal v-model="cancelOpen" title="Cancel side meeting" size="sm">
      <div class="px-4 sm:px-6 py-5">
        <div
          class="flex items-start gap-3 p-4 rounded-xl"
          style="background: rgba(240,113,106,.1); border: 1px solid rgba(240,113,106,.3)">
          <TriangleAlert class="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-semibold text-bad mb-1">{{ cancelling?.title }}</p>
            <p class="text-sm text-text-dim">
              This releases the room and time slot for other organizers. It cannot be undone — you
              would have to submit a new request.
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-border">
          <button class="btn-secondary" @click="cancelOpen = false">Keep it</button>
          <button class="btn-danger" @click="confirmCancel">
            <X class="w-4 h-4" /> Cancel side meeting
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { Users, Pencil, X, Hourglass, TriangleAlert, Info } from 'lucide-vue-next'
import type { MyBooking } from '~/composables/useMyBookings'

const props = defineProps<{
  // Which states this section lists (Rejected covers cancelled requests too).
  states: MyBooking['state'][]
  emptyTitle: string
  emptyHint: string
}>()

const { bookings, meeting, loading, loaded, error, load } = useMyBookings()
const { minutesToTime, formatSubmittedAt } = useTemporal()
const toast = useToastStore()

const items = computed(() =>
  bookings.value.filter((b) => props.states.includes(b.state))
)

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

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Day and time range of a booking, in the meeting's timezone (the same frame the
// public schedule and the request flow use).
function when(b: MyBooking) {
  const tz = meeting.value?.timezone || 'UTC'
  try {
    const zdt = Temporal.Instant.from(b.startsAt).toZonedDateTimeISO(tz)
    const startMin = zdt.hour * 60 + zdt.minute
    return {
      day: `${WEEKDAYS[zdt.dayOfWeek - 1]}, ${MONTHS[zdt.month - 1]} ${zdt.day} ·`,
      range: `${minutesToTime(startMin)}–${minutesToTime(startMin + b.duration)}`
    }
  } catch {
    return { day: '', range: '' }
  }
}

// ── Organizer actions ───────────────────────────────────────────────────────
// Mirrors the server rules: a rejected or cancelled request is closed, and one
// that has already begun can no longer be cancelled or amended.
function isEditable(b: MyBooking) {
  if (b.state !== 'pending' && b.state !== 'confirmed') return false
  return !hasStarted(b)
}

function hasStarted(b: MyBooking) {
  try {
    return Temporal.Instant.compare(Temporal.Now.instant(), Temporal.Instant.from(b.startsAt)) >= 0
  } catch {
    return false
  }
}

const busyId = ref<string | null>(null)

const editOpen = ref(false)
const editing = ref<MyBooking | null>(null)
const editText = ref('')
const savingEdit = ref(false)
const editRef = ref<HTMLTextAreaElement | null>(null)

// A pending request hasn't been reviewed yet, so its description is edited in
// place; only an approved one needs the change signed off.
const needsApproval = computed(() => editing.value?.state === 'confirmed')

const canSubmitEdit = computed(() => {
  if (savingEdit.value || !editText.value.trim()) return false
  // Nothing to review if the text matches what is already proposed or live.
  const current = editing.value?.pendingDescription ?? editing.value?.description ?? ''
  return editText.value.trim() !== current.trim()
})

function autoGrow() {
  const el = editRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 320)}px`
}

function openEdit(b: MyBooking) {
  editing.value = b
  // Keep editing the change already under review, if there is one.
  editText.value = b.pendingDescription ?? b.description ?? ''
  editOpen.value = true
  nextTick(autoGrow)
}

async function submitEdit() {
  if (!editing.value || !canSubmitEdit.value) return
  savingEdit.value = true
  try {
    await useApiFetch(`/bookings/${editing.value.id}/description`, {
      method: 'PATCH',
      body: { description: editText.value.trim() }
    })
    toast.show(needsApproval.value ? 'Description submitted for approval' : 'Description updated', 'ok')
    editOpen.value = false
    await load(true)
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to submit the description', 'bad')
  } finally {
    savingEdit.value = false
  }
}

// Re-submitting the live description clears the staged change server-side.
async function withdrawChange(b: MyBooking) {
  busyId.value = b.id
  try {
    await useApiFetch(`/bookings/${b.id}/description`, {
      method: 'PATCH',
      body: { description: b.description ?? '' }
    })
    toast.show('Description change withdrawn', 'ok')
    await load(true)
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to withdraw the change', 'bad')
  } finally {
    busyId.value = null
  }
}

const cancelOpen = ref(false)
const cancelling = ref<MyBooking | null>(null)

function askCancel(b: MyBooking) {
  cancelling.value = b
  cancelOpen.value = true
}

async function confirmCancel() {
  const b = cancelling.value
  cancelOpen.value = false
  if (!b) return
  busyId.value = b.id
  try {
    await useApiFetch(`/bookings/${b.id}/cancel`, { method: 'PATCH' })
    toast.show('Side meeting cancelled', 'ok')
    await load(true)
  } catch (e: any) {
    toast.show(e?.data?.message || 'Failed to cancel', 'bad')
  } finally {
    busyId.value = null
    cancelling.value = null
  }
}

// The layout loads this too; load() is a no-op once the data is in place, and
// this keeps the page working if it is ever mounted on its own.
onMounted(load)
</script>
