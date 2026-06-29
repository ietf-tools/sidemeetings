<template>
  <div class="max-w-[1180px] mx-auto">
    <!-- Stat cards -->
    <div class="grid grid-cols-3 gap-4 mb-5">
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--warn)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Pending requests</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">{{ dashboard?.pendingCount ?? 0 }}</div>
        <div class="text-xs text-text-faint mt-1.5">awaiting your review</div>
      </div>
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--ok)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Approved</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">{{ dashboard?.confirmedCount ?? 0 }}</div>
        <div class="text-xs text-text-faint mt-1.5">bookings</div>
      </div>
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--accent)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Rooms available</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">{{ dashboard?.roomCount ?? 0 }}</div>
        <div class="text-xs text-text-faint mt-1.5">at {{ meetingStore.viewingMeeting?.city || '—' }}</div>
      </div>
    </div>

    <div class="grid grid-cols-[1.5fr_1fr] gap-5">
      <!-- Pending review -->
      <div class="card overflow-hidden self-start">
        <div class="px-[18px] py-4 border-b border-border flex items-center justify-between">
          <h2 class="text-[15px] font-bold text-text">Pending review</h2>
          <NuxtLink to="/admin/bookings?filter=pending" class="text-[12.5px] font-semibold text-accent hover:underline">View all →</NuxtLink>
        </div>
        <div v-if="loading" class="px-5 py-10 text-center text-text-dim text-sm">Loading…</div>
        <div v-else-if="!dashboard?.recentPending?.length" class="px-5 py-12 text-center">
          <div class="text-sm font-semibold text-text-dim">All caught up</div>
          <div class="text-[12.5px] text-text-faint mt-1">No requests awaiting review.</div>
        </div>
        <div v-else>
          <div
            v-for="b in dashboard.recentPending"
            :key="b.id"
            class="flex items-center gap-3.5 px-[18px] py-3.5 border-b border-border last:border-0">
            <div class="flex-1 min-w-0 cursor-pointer" @click="navigateTo('/admin/bookings/' + b.id)">
              <div class="text-sm font-semibold text-text truncate">{{ b.title }}</div>
              <div class="text-xs text-text-dim mt-0.5">
                {{ b.organizerName }} · {{ b.roomName }} ·
                <span class="font-mono">{{ bookingTimeLabel(b) }}</span>
              </div>
            </div>
            <button class="icon-btn !w-8 !h-8 text-bad flex-shrink-0" title="Reject" @click="reject(b.id)">
              <X class="w-4 h-4" />
            </button>
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ok text-white text-[12.5px] font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
              title="Approve"
              @click="approve(b.id)">
              <Check class="w-3.5 h-3.5" :stroke-width="2.6" /> Approve
            </button>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-5">
        <!-- Room utilization -->
        <div class="card p-[18px]">
          <h2 class="text-[15px] font-bold text-text mb-3.5">Room utilization</h2>
          <div v-if="loading" class="py-4 text-center text-text-dim text-sm">Loading…</div>
          <div v-else-if="!dashboard?.roomUtilization?.length" class="py-4 text-center text-text-dim text-sm">
            No rooms configured
          </div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="r in dashboard.roomUtilization" :key="r.roomId">
              <div class="flex justify-between text-[12.5px] mb-1.5">
                <span class="font-semibold text-text">{{ r.roomName }}</span>
                <span class="text-text-dim font-mono text-[11.5px]">{{ Math.round(r.bookedMinutes / 60) }}h / {{ Math.round(r.totalAvailableMinutes / 60) }}h</span>
              </div>
              <div class="h-[7px] rounded-md bg-s3 overflow-hidden">
                <div class="h-full rounded-md bg-accent transition-all" :style="{ width: Math.min(100, r.totalAvailableMinutes ? (r.bookedMinutes / r.totalAvailableMinutes) * 100 : 0) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="card p-[18px]">
          <h2 class="text-[15px] font-bold text-text mb-3.5">Recent activity</h2>
          <div v-if="loading" class="py-4 text-center text-text-dim text-sm">Loading…</div>
          <div v-else-if="!dashboard?.recentActivity?.length" class="py-4 text-center text-text-dim text-sm">
            No recent activity
          </div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="a in dashboard.recentActivity" :key="a.id" class="flex gap-2.5 items-start">
              <span class="mt-[5px] w-2 h-2 rounded-full flex-shrink-0" :style="{ background: activityColor(a.action) }"></span>
              <div class="text-[12.5px] leading-snug min-w-0">
                <span class="text-text">{{ describeActivity(a) }}</span>
                <div class="text-[11px] text-text-faint mt-0.5">{{ formatSubmittedAt(a.createdAt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X, Check } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Dashboard'
pageSubtitle.value = 'Overview of your meeting'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const { formatSubmittedAt } = useTemporal()

const loading = ref(true)
const dashboard = ref<any>(null)

// Dot color for an activity entry, keyed by action.
function activityColor(action: string) {
  switch (action) {
    case 'confirmed': return 'var(--ok)'
    case 'rejected': return 'var(--bad)'
    case 'cancelled': return 'var(--muted)'
    case 'submitted': return 'var(--warn)'
    default: return 'var(--accent)'
  }
}

function bookingTimeLabel(b: any): string {
  try {
    const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
    const zdt = Temporal.Instant.from(b.startsAt).toZonedDateTimeISO(tz)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const h = String(zdt.hour).padStart(2, '0')
    const m = String(zdt.minute).padStart(2, '0')
    return `${days[zdt.dayOfWeek - 1]} ${zdt.day} · ${h}:${m}`
  } catch {
    return ''
  }
}

function describeActivity(a: any): string {
  const who = a.userName || 'Someone'
  const what = a.bookingTitle ? `"${a.bookingTitle}"` : 'a booking'
  switch (a.action) {
    case 'submitted': return `${who} submitted ${what}`
    case 'confirmed': return `${who} confirmed ${what}`
    case 'rejected': return `${who} rejected ${what}`
    case 'cancelled': return `${who} cancelled ${what}`
    case 'updated': return `${who} updated ${what}`
    default: return `${who} acted on ${what}`
  }
}

async function loadDashboard() {
  if (!meetingStore.viewingMeeting) return
  loading.value = true
  try {
    dashboard.value = await useApiFetch(`/dashboard?viewMeetingId=${meetingStore.viewingMeeting.id}`)
  } catch {
    toast.show('Failed to load dashboard', 'bad')
  } finally {
    loading.value = false
  }
}

async function approve(id: string) {
  try {
    await useApiFetch(`/bookings/${id}/confirm`, { method: 'PATCH' })
    toast.show('Booking approved', 'ok')
    await loadDashboard()
  } catch {
    toast.show('Failed to approve booking', 'bad')
  }
}

async function reject(id: string) {
  try {
    await useApiFetch(`/bookings/${id}/reject`, { method: 'PATCH' })
    toast.show('Booking rejected', 'bad')
    await loadDashboard()
  } catch {
    toast.show('Failed to reject booking', 'bad')
  }
}

watch(() => meetingStore.viewingMeeting?.id, () => { loadDashboard() })
onMounted(() => { loadDashboard() })
</script>
