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
      <div class="relative flex items-center w-full max-w-[280px]">
        <Search class="w-4 h-4 text-text-faint absolute left-3 pointer-events-none" />
        <input
          v-model="search"
          type="text"
          placeholder="Search bookings…"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border-strong text-text text-[13.5px] outline-none focus:border-accent transition-colors" />
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
            <th class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-5 py-3">Side meeting</th>
            <th class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">Room</th>
            <th class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">Time</th>
            <th class="text-left text-[11px] font-bold uppercase tracking-wide text-text-dim px-4 py-3">Status</th>
            <th class="text-right text-[11px] font-bold uppercase tracking-wide text-text-dim px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="b in filteredBookings"
            :key="b.id"
            class="cursor-pointer hover:bg-s2 transition-colors"
            @click="navigateTo('/admin/bookings/' + b.id)"
          >
            <td class="px-5 py-3.5">
              <div class="text-sm font-semibold text-text" :class="{ 'line-through text-text-faint': b.state === 'rejected' || b.state === 'cancelled' }">
                {{ b.title }}
              </div>
              <div class="text-xs text-text-dim mt-0.5">{{ b.organizerName }}</div>
            </td>
            <td class="px-4 py-3.5">
              <span class="text-[13px] text-text">{{ b.roomName }}</span>
            </td>
            <td class="px-4 py-3.5">
              <template v-if="b.startsAt">
                <div class="text-[12.5px] font-semibold text-text">{{ bookingTimeLabel(b.startsAt, b.duration).day }}</div>
                <div class="text-[11.5px] text-text-dim font-mono">{{ bookingTimeLabel(b.startsAt, b.duration).start }}–{{ bookingTimeLabel(b.startsAt, b.duration).end }}</div>
              </template>
            </td>
            <td class="px-4 py-3.5">
              <AdminStatusBadge :state="b.state" />
            </td>
            <td class="px-5 py-3.5" @click.stop>
              <div class="flex items-center gap-1.5 justify-end">
                <template v-if="b.state === 'pending'">
                  <button class="icon-btn text-bad" title="Reject" @click="reject(b.id)">
                    <X class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="w-[30px] h-[30px] rounded-lg bg-ok text-white flex items-center justify-center transition-opacity hover:opacity-90"
                    title="Approve"
                    @click="approve(b.id)">
                    <Check class="w-3.5 h-3.5" :stroke-width="2.6" />
                  </button>
                </template>
                <NuxtLink
                  :to="'/admin/bookings/' + b.id"
                  class="text-[12.5px] font-semibold text-text-dim bg-s2 border border-border rounded-lg px-2.5 py-1.5 hover:text-text transition-colors">
                  Open
                </NuxtLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, X, Check } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Bookings'
pageSubtitle.value = 'Manage side meeting requests'

const meetingStore = useMeetingStore()
const toast = useToastStore()
const route = useRoute()
const { minutesToTime } = useTemporal()

const loading = ref(true)
const bookings = ref<any[]>([])
const search = ref('')
const activeFilter = ref((route.query.filter as string) || 'all')

const tabs = computed(() => [
  { key: 'all', label: 'All', count: bookings.value.length },
  { key: 'pending', label: 'Pending', count: bookings.value.filter((b) => b.state === 'pending').length },
  { key: 'confirmed', label: 'Approved', count: bookings.value.filter((b) => b.state === 'confirmed').length },
  { key: 'rejected', label: 'Rejected', count: bookings.value.filter((b) => b.state === 'rejected').length },
  { key: 'cancelled', label: 'Cancelled', count: bookings.value.filter((b) => b.state === 'cancelled').length },
])

const filteredBookings = computed(() => {
  let list = bookings.value
  if (activeFilter.value !== 'all') {
    list = list.filter((b) => b.state === activeFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((b) => b.title.toLowerCase().includes(q) || b.organizerName?.toLowerCase().includes(q))
  }
  return list
})

function bookingTimeLabel(startsAt: string, duration: number): { day: string; start: string; end: string } {
  const tz = meetingStore.viewingMeeting?.timezone || 'UTC'
  try {
    const zdt = Temporal.Instant.from(startsAt).toZonedDateTimeISO(tz)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayLabel = `${days[zdt.dayOfWeek - 1]} ${zdt.day}`
    const startMin = zdt.hour * 60 + zdt.minute
    return { day: dayLabel, start: minutesToTime(startMin), end: minutesToTime(startMin + duration) }
  } catch {
    return { day: '', start: '', end: '' }
  }
}

async function loadBookings() {
  if (!meetingStore.viewingMeeting) return
  loading.value = true
  try {
    bookings.value = await useApiFetch<any[]>(`/meetings/${meetingStore.viewingMeeting.id}/bookings`)
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

watch(() => meetingStore.viewingMeeting?.id, () => { loadBookings() })
onMounted(() => { loadBookings() })
</script>
