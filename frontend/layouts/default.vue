<template>
  <div class="flex min-h-screen bg-bg">
    <!-- Sidebar -->
    <aside class="w-[252px] flex-shrink-0 flex flex-col" style="background: #0a0d12; border-right: 1px solid #1a2029;">
      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-3 px-4 pt-5 pb-4 transition-opacity hover:opacity-80">
        <img
          src="https://static.ietf.org/logos/ietf-square-inverted.svg"
          alt="IETF"
          class="w-9 h-9 flex-shrink-0" />
        <div>
          <div class="text-text font-semibold text-[14px] leading-tight">Side Meetings</div>
          <div class="text-sidebar-text-dim text-[11px]">Admin console</div>
        </div>
      </NuxtLink>

      <!-- Meeting Picker Button -->
      <div class="px-3.5 pb-1 pt-0.5">
        <p class="text-[10px] font-bold text-sidebar-text-dim uppercase tracking-[0.06em] px-0.5 pb-1.5">
          Viewing meeting
        </p>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] text-left transition-colors bg-s2 border border-border hover:bg-s3 hover:border-border-strong"
          title="Switch the meeting you are viewing"
          @click="pickerOpen = true"
        >
          <div class="w-8 h-8 rounded-lg bg-accent-weak border border-accent/30 flex items-center justify-center flex-shrink-0">
            <span class="text-accent text-xs font-bold font-mono">{{ meetingStore.viewingMeeting?.num ?? '—' }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-bold text-white truncate">{{ meetingCode }}</div>
            <div class="text-[11px] text-sidebar-text truncate">{{ meetingCity }}</div>
          </div>
          <ChevronsUpDown class="w-3.5 h-3.5 text-sidebar-text-dim flex-shrink-0" />
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        <div>
          <p class="text-[10px] font-semibold text-sidebar-text-dim uppercase tracking-wider px-2 mb-1.5">Meeting</p>
          <div class="space-y-0.5">
            <AdminNavItem to="/admin" :icon="LayoutGrid" label="Dashboard" :exact="true" />
            <AdminNavItem to="/admin/bookings" :icon="List" label="Bookings" :badge="pendingCount" />
            <AdminNavItem to="/admin/rooms" :icon="Building2" label="Rooms" />
          </div>
        </div>
        <div>
          <p class="text-[10px] font-semibold text-sidebar-text-dim uppercase tracking-wider px-2 mb-1.5">Global</p>
          <div class="space-y-0.5">
            <AdminNavItem to="/admin/meetings" :icon="CalendarDays" label="Meetings" />
            <AdminNavItem to="/admin/users" :icon="Users" label="Users" />
            <AdminNavItem to="/admin/settings" :icon="Settings" label="Settings" />
          </div>
        </div>
        <div>
          <p class="text-[10px] font-semibold text-sidebar-text-dim uppercase tracking-wider px-2 mb-1.5">Organizer</p>
          <div class="space-y-0.5">
            <AdminNavItem to="/request" :icon="CalendarPlus" label="Request a meeting" />
            <AdminNavItem to="/" :icon="Globe" label="Public view" :exact="true" />
          </div>
        </div>
      </nav>

      <!-- User block -->
      <div ref="userBlockRef" class="relative border-t border-sidebar-border">
        <button
          class="w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-white/5"
          @click="userMenuOpen = !userMenuOpen"
        >
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 text-white"
            style="background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sidebar-text text-[13px] font-semibold truncate">{{ auth.user?.name }}</div>
            <div class="text-sidebar-text-dim text-[11px] font-mono truncate">{{ auth.user?.email }}</div>
          </div>
          <ChevronsUpDown class="w-3.5 h-3.5 text-sidebar-text-dim flex-shrink-0" />
        </button>
        <Transition name="menu">
          <div v-if="userMenuOpen"
            class="absolute bottom-full left-3 right-3 mb-1 rounded-[11px] border border-border p-1.5"
            style="background: var(--surface); box-shadow: 0 12px 32px rgba(0,0,0,.4);">
            <button
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-bad hover:bg-white/5 transition-colors text-left"
              @click="handleLogout"
            >
              <LogOut class="w-4 h-4" />
              Log out
            </button>
          </div>
        </Transition>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top bar -->
      <header class="flex items-center justify-between px-8 py-5 border-b border-border bg-surface">
        <div>
          <h1 class="text-[18px] font-bold text-text leading-tight">{{ pageTitle }}</h1>
          <p v-if="pageSubtitle" class="text-[12.5px] text-text-dim mt-0.5">{{ pageSubtitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <slot name="topbar-actions" />
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-8 overflow-auto">
        <slot />
      </main>
    </div>

    <!-- Meeting Picker Modal -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="pickerOpen"
          class="fixed inset-0 z-50 flex items-center justify-center"
          style="background: rgba(0,0,0,0.6);"
          @click.self="pickerOpen = false">
          <div class="card w-[520px] max-w-[calc(100vw-2rem)] max-h-[86vh] flex flex-col p-6" @click.stop>
            <h2 class="text-[17px] font-bold text-text mb-1">Switch meeting</h2>
            <p class="text-[12.5px] text-text-dim mb-3.5">
              Choose which meeting to view. This doesn't change the active meeting used for new
              bookings.
            </p>

            <!-- Search -->
            <div class="relative flex items-center mb-3.5">
              <Search class="w-4 h-4 text-text-faint absolute left-3 pointer-events-none" />
              <input
                v-model="pickerSearch"
                type="text"
                placeholder="Search by number, city or venue…"
                class="w-full pl-9 pr-3 py-2.5 rounded-lg bg-s2 border border-border-strong text-text text-[13.5px] outline-none focus:border-accent transition-colors" />
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-[120px] max-h-[52vh] -mx-1 px-1 py-0.5">
              <button
                v-for="m in filteredMeetings"
                :key="m.id"
                class="flex items-center gap-3.5 w-full text-left p-3.5 rounded-xl border transition-all"
                :class="
                  meetingStore.viewingMeeting?.id === m.id
                    ? 'bg-accent-weak border-accent shadow-room-selected'
                    : 'bg-s2 border-border hover:border-border-strong'
                "
                @click="selectMeeting(m)">
                <div class="w-11 h-11 rounded-[11px] bg-accent-weak border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <span class="text-accent text-sm font-extrabold font-mono">{{ m.num }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[14.5px] font-bold text-text">
                      {{ meetingLabel(m.num) }} · {{ m.city }}, {{ m.country }}
                    </span>
                    <span
                      class="text-[10.5px] font-semibold px-2 py-px rounded-full"
                      :style="`color:${meetingStatus(m).color}; background:color-mix(in srgb, ${meetingStatus(m).color} 14%, transparent);`">
                      {{ meetingStatus(m).label }}
                    </span>
                  </div>
                  <div class="text-xs text-text-dim mt-1">
                    {{ formatDateRange(m.startDate, m.endDate) }} · {{ m.venue }}
                  </div>
                </div>
                <Check
                  v-if="meetingStore.viewingMeeting?.id === m.id"
                  class="w-5 h-5 text-accent flex-shrink-0" />
              </button>
              <div
                v-if="filteredMeetings.length === 0"
                class="py-10 text-center text-text-faint text-sm">
                No meetings match your search.
              </div>
            </div>

            <!-- Footer -->
            <div class="flex justify-end mt-4">
              <button class="btn-secondary text-text-dim" @click="pickerOpen = false">Close</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast notifications -->
    <AdminToast />
  </div>
</template>

<script setup lang="ts">
import { LayoutGrid, List, Building2, CalendarDays, Users, Settings, CalendarPlus, Globe, ChevronsUpDown, LogOut, Search, Check } from '@lucide/vue'

// Provide page meta via useState
const pageTitle = useState('page-title', () => 'Dashboard')
const pageSubtitle = useState('page-subtitle', () => '')

const auth = useAuthStore()
const meetingStore = useMeetingStore()
const { formatDateRange } = useTemporal()

const pickerOpen = ref(false)
const pickerSearch = ref('')
const userMenuOpen = ref(false)
const userBlockRef = ref<HTMLElement | null>(null)

const meetingCode = computed(() =>
  meetingStore.viewingMeeting ? meetingLabel(meetingStore.viewingMeeting.num) : 'Select a meeting'
)
const meetingCity = computed(() => {
  const m = meetingStore.viewingMeeting
  if (!m) return 'No meeting selected'
  return m.country ? `${m.city}, ${m.country}` : m.city
})

const userInitials = computed(() => {
  const name = auth.user?.name || ''
  return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
})

const pendingCount = ref(0)

const filteredMeetings = computed(() => {
  const q = pickerSearch.value.toLowerCase()
  return [...meetingStore.meetings]
    .sort((a, b) => Number(b.num) - Number(a.num))
    .filter(
      (m) =>
        !q ||
        meetingLabel(m.num).toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q) ||
        String(m.num).includes(q)
    )
})

// Status pill for a meeting row: active / past / planning, matching the design tokens.
function meetingStatus(m: typeof meetingStore.meetings[0]) {
  if (m.isActive) return { label: 'Active', color: 'var(--ok)' }
  try {
    const end = Temporal.PlainDate.from(m.endDate)
    if (Temporal.PlainDate.compare(end, Temporal.Now.plainDateISO()) < 0) {
      return { label: 'Past', color: 'var(--muted)' }
    }
  } catch {
    // fall through to planning
  }
  return { label: 'Planning', color: 'var(--accent)' }
}

function selectMeeting(m: typeof meetingStore.meetings[0]) {
  meetingStore.setViewingMeeting(m)
  pickerOpen.value = false
}

async function handleLogout() {
  userMenuOpen.value = false
  await auth.logout()
}

// Close user menu only when clicking outside the user block (so the toggle
// click that opens it doesn't immediately close it again).
function handleOutsideClick(e: MouseEvent) {
  if (userBlockRef.value && !userBlockRef.value.contains(e.target as Node)) {
    userMenuOpen.value = false
  }
}

onMounted(async () => {
  await meetingStore.fetchMeetings()
  // Fetch pending count
  if (meetingStore.viewingMeeting) {
    try {
      const data = await useApiFetch<{ pendingCount: number }>(`/dashboard?viewMeetingId=${meetingStore.viewingMeeting.id}`)
      pendingCount.value = data.pendingCount ?? 0
    } catch {
      // ignore
    }
  }
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

// AdminNavItem is auto-imported from components/admin/NavItem.vue
</script>

<style scoped>
.menu-enter-active, .menu-leave-active { transition: all 0.15s; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(4px); }

/* Matches the shared AdminModal (Modal.vue) animation: fade the overlay and
   scale the card so all dialogs open/close identically. */
.overlay-enter-active, .overlay-leave-active { transition: all 0.2s; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.overlay-enter-from .card, .overlay-leave-to .card { transform: scale(0.95); }
.overlay-enter-active .card, .overlay-leave-active .card { transition: transform 0.2s; }
</style>
