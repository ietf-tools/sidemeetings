<template>
  <div class="max-w-[1180px] mx-auto">
    <!-- Stat cards -->
    <div class="grid grid-cols-3 gap-4 mb-5">
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--warn)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Pending requests</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">
          {{ dashboard?.pendingCount ?? 0 }}
        </div>
        <div class="text-xs text-text-faint mt-1.5">awaiting your review</div>
      </div>
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--ok)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Approved</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">
          {{ dashboard?.confirmedCount ?? 0 }}
        </div>
        <div class="text-xs text-text-faint mt-1.5">bookings</div>
      </div>
      <div class="card p-[18px]">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="w-2 h-2 rounded-full" style="background: var(--accent)"></span>
          <span class="text-[12.5px] font-semibold text-text-dim">Rooms available</span>
        </div>
        <div class="text-[34px] font-extrabold text-text leading-none tracking-tight">
          {{ dashboard?.roomCount ?? 0 }}
        </div>
        <div class="text-xs text-text-faint mt-1.5">
          at {{ meetingStore.viewingMeeting?.city || '—' }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-[1.5fr_1fr] gap-5 items-start">
      <!-- Left column -->
      <div class="flex flex-col gap-5">
        <!-- Pending review -->
        <div class="card overflow-hidden">
          <div class="px-[18px] py-4 border-b border-border flex items-center justify-between">
            <h2 class="text-[15px] font-bold text-text">Pending review</h2>
            <NuxtLink
              to="/admin/bookings?filter=pending"
              class="text-[12.5px] font-semibold text-accent hover:underline"
              >View all →</NuxtLink
            >
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
              <div
                class="flex-1 min-w-0 cursor-pointer"
                @click="navigateTo('/admin/bookings/' + b.id)">
                <div class="text-sm font-semibold text-text truncate">{{ b.title }}</div>
                <div class="text-xs text-text-dim mt-0.5">
                  {{ b.organizerName }} · {{ b.roomName }} ·
                  <span class="font-mono">{{ bookingTimeLabel(b) }}</span>
                </div>
              </div>
              <NuxtLink
                :to="'/admin/bookings/' + b.id"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-strong bg-surface text-text text-[12.5px] font-semibold transition-colors hover:text-accent hover:border-accent flex-shrink-0">
                <Eye class="w-3.5 h-3.5" /> Review
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Description changes awaiting review -->
        <div class="card overflow-hidden">
          <div class="px-[18px] py-4 border-b border-border flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <h2 class="text-[15px] font-bold text-text">Description changes</h2>
              <span
                v-if="dashboard?.pendingDescriptionCount"
                class="text-[10px] px-1.5 py-0.5 rounded-full bg-warn/20 text-warn font-semibold">
                {{ dashboard.pendingDescriptionCount }}
              </span>
            </div>
            <span class="text-[11.5px] text-text-faint">Current text stays published</span>
          </div>
          <div v-if="loading" class="px-5 py-10 text-center text-text-dim text-sm">Loading…</div>
          <div v-else-if="!dashboard?.pendingDescriptions?.length" class="px-5 py-12 text-center">
            <div class="text-sm font-semibold text-text-dim">Nothing to review</div>
            <div class="text-[12.5px] text-text-faint mt-1">
              Organizers of approved side meetings can propose a new description.
            </div>
          </div>
          <div v-else>
            <div
              v-for="d in dashboard.pendingDescriptions"
              :key="d.id"
              class="flex items-center gap-3.5 px-[18px] py-3.5 border-b border-border last:border-0">
              <div
                class="flex-1 min-w-0 cursor-pointer"
                @click="navigateTo('/admin/bookings/' + d.id)">
                <div class="text-sm font-semibold text-text truncate">{{ d.title }}</div>
                <div class="text-xs text-text-dim mt-0.5 truncate">
                  {{ d.organizerName }} · {{ d.roomName }} ·
                  <span class="text-text-faint">
                    requested {{ formatSubmittedAt(d.pendingDescriptionAt) }}
                  </span>
                </div>
              </div>
              <NuxtLink
                :to="'/admin/bookings/' + d.id"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-strong bg-surface text-text text-[12.5px] font-semibold transition-colors hover:text-accent hover:border-accent flex-shrink-0">
                <GitCompareArrows class="w-3.5 h-3.5" /> Review diff
              </NuxtLink>
            </div>
            <div
              v-if="dashboard.pendingDescriptionCount > dashboard.pendingDescriptions.length"
              class="px-[18px] py-2.5 border-t border-border text-[11.5px] text-text-faint">
              +{{ dashboard.pendingDescriptionCount - dashboard.pendingDescriptions.length }} more
              awaiting review
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-5">
        <!-- Room utilization -->
        <div class="card p-[18px]">
          <h2 class="text-[15px] font-bold text-text mb-3.5">Room utilization</h2>
          <div v-if="loading" class="py-4 text-center text-text-dim text-sm">Loading…</div>
          <div
            v-else-if="!dashboard?.roomUtilization?.length"
            class="py-4 text-center text-text-dim text-sm">
            No rooms configured
          </div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="r in dashboard.roomUtilization" :key="r.roomId">
              <div class="flex justify-between text-[12.5px] mb-1.5">
                <span class="font-semibold text-text">{{ r.roomName }}</span>
                <span class="text-text-dim font-mono text-[11.5px]"
                  >{{ Math.round(r.bookedMinutes / 60) }}h /
                  {{ Math.round(r.totalAvailableMinutes / 60) }}h</span
                >
              </div>
              <div class="h-[7px] rounded-md bg-s3 overflow-hidden flex">
                <div
                  class="h-full bg-accent transition-all"
                  :style="{ width: utilPct(r.bookedMinutes, r.totalAvailableMinutes) + '%' }"></div>
                <div
                  class="h-full bg-warn transition-all"
                  :style="{
                    width:
                      utilPct(
                        r.totalAvailableMinutes - r.bookedMinutes - (r.bookableFreeMinutes ?? 0),
                        r.totalAvailableMinutes
                      ) + '%'
                  }"></div>
              </div>
            </div>
            <div class="flex items-center gap-3 pt-1 text-[10px] text-text-faint">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-accent"></span> Booked
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-warn"></span> Unallocatable
              </span>
            </div>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="card p-[18px]">
          <h2 class="text-[15px] font-bold text-text mb-3.5">Recent activity</h2>
          <div v-if="loading" class="py-4 text-center text-text-dim text-sm">Loading…</div>
          <div
            v-else-if="!dashboard?.recentActivity?.length"
            class="py-4 text-center text-text-dim text-sm">
            No recent activity
          </div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="a in dashboard.recentActivity" :key="a.id" class="flex gap-2.5 items-start">
              <span
                class="mt-[5px] w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: activityColor(a.action) }"></span>
              <div class="text-[12.5px] leading-snug min-w-0">
                <span class="text-text">{{ describeActivity(a) }}</span>
                <div class="text-[11px] text-text-faint mt-0.5">
                  {{ formatSubmittedAt(a.createdAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, GitCompareArrows } from '@lucide/vue'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Dashboard'
pageSubtitle.value = 'Overview of the meeting'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const { formatSubmittedAt } = useTemporal()

const loading = ref(true)
const dashboard = ref<any>(null)

// Clamp a part/total ratio to a 0–100 percentage for the utilization bar.
function utilPct(part: number, total: number) {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, (part / total) * 100))
}

// Dot color for an activity entry, keyed by action.
function activityColor(action: string) {
  switch (action) {
    case 'confirmed':
      return 'var(--ok)'
    case 'rejected':
      return 'var(--bad)'
    case 'cancelled':
      return 'var(--muted)'
    case 'submitted':
      return 'var(--warn)'
    default:
      return 'var(--accent)'
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
    case 'submitted':
      return `${who} submitted ${what}`
    case 'confirmed':
      return `${who} confirmed ${what}`
    case 'rejected':
      return `${who} rejected ${what}`
    case 'cancelled':
      return `${who} cancelled ${what}`
    case 'updated':
      return `${who} updated ${what}`
    default:
      return `${who} acted on ${what}`
  }
}

async function loadDashboard() {
  if (!meetingStore.viewingMeeting) return
  loading.value = true
  try {
    dashboard.value = await useApiFetch(
      `/dashboard?viewMeetingId=${meetingStore.viewingMeeting.id}`
    )
  } catch {
    toast.show('Failed to load dashboard', 'bad')
  } finally {
    loading.value = false
  }
}

watch(
  () => meetingStore.viewingMeeting?.id,
  () => {
    loadDashboard()
  }
)
onMounted(() => {
  loadDashboard()
})
</script>
