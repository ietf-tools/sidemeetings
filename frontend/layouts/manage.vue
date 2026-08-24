<template>
  <div class="flex min-h-screen bg-bg">
    <!-- Backdrop behind the mobile drawer -->
    <Transition name="fade">
      <div
        v-if="navOpen"
        class="fixed inset-0 z-40 bg-black/60 lg:hidden"
        @click="navOpen = false"></div>
    </Transition>

    <!-- Sidebar: a slide-over drawer below lg, static from lg up -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-[264px] max-w-[85vw] flex flex-col transition-transform duration-200 lg:static lg:z-auto lg:w-[252px] lg:flex-shrink-0 lg:translate-x-0"
      :class="navOpen ? 'translate-x-0' : '-translate-x-full'"
      style="background: #0a0d12; border-right: 1px solid #1a2029;">
      <!-- Logo -->
      <div class="flex items-center gap-2 pr-2 lg:pr-0">
        <NuxtLink
          to="/"
          class="flex-1 min-w-0 flex items-center gap-3 px-4 pt-5 pb-4 transition-opacity hover:opacity-80">
          <img
            src="https://static.ietf.org/logos/ietf-square-inverted.svg"
            alt="IETF"
            class="w-9 h-9 flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-text font-semibold text-[14px] leading-tight truncate">Side Meetings</div>
            <div class="text-sidebar-text-dim text-[11px]">My requests</div>
          </div>
        </NuxtLink>
        <button
          class="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-sidebar-text-dim hover:text-text transition-colors flex-shrink-0"
          aria-label="Close menu"
          @click="navOpen = false">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Meeting the listed bookings belong to -->
      <div v-if="myMeeting" class="px-3.5 pb-1 pt-0.5">
        <p class="text-[10px] font-bold text-sidebar-text-dim uppercase tracking-[0.06em] px-0.5 pb-1.5">
          Meeting
        </p>
        <div class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] bg-s2 border border-border">
          <div class="w-8 h-8 rounded-lg bg-accent-weak border border-accent/30 flex items-center justify-center flex-shrink-0">
            <span class="text-accent text-xs font-bold font-mono">{{ myMeeting.num }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-bold text-white truncate">
              {{ meetingLabel(myMeeting.num) }}
            </div>
            <div class="text-[11px] text-sidebar-text truncate">{{ meetingCity }}</div>
          </div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        <div>
          <p class="text-[10px] font-semibold text-sidebar-text-dim uppercase tracking-wider px-2 mb-1.5">
            My side meetings
          </p>
          <div class="space-y-0.5">
            <AdminNavItem
              to="/manage"
              :icon="Clock"
              label="Pending Review"
              :badge="counts.pending"
              :exact="true" />
            <AdminNavItem
              to="/manage/confirmed"
              :icon="CircleCheck"
              label="Confirmed"
              :badge="counts.confirmed"
              badge-tone="neutral" />
            <AdminNavItem
              to="/manage/rejected"
              :icon="CircleX"
              label="Rejected"
              :badge="counts.rejected"
              badge-tone="neutral" />
          </div>
        </div>
        <div>
          <div class="space-y-0.5">
            <AdminNavItem to="/" :icon="ArrowLeft" label="Back to home" :exact="true" />
          </div>
        </div>
      </nav>

      <!-- User block -->
      <div ref="userBlockRef" class="relative border-t border-sidebar-border">
        <button
          class="w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-white/5"
          @click="userMenuOpen = !userMenuOpen">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 text-white"
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
          <div
            v-if="userMenuOpen"
            class="absolute bottom-full left-3 right-3 mb-1 rounded-[11px] border border-border p-1.5"
            style="background: var(--surface); box-shadow: 0 12px 32px rgba(0,0,0,.4);">
            <NuxtLink
              v-if="auth.isAdmin"
              to="/admin"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-sidebar-text hover:bg-white/5 transition-colors"
              @click="userMenuOpen = false">
              <LayoutGrid class="w-4 h-4" />
              Admin console
            </NuxtLink>
            <button
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-bad hover:bg-white/5 transition-colors text-left"
              @click="handleLogout">
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
      <header
        class="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface sm:px-6 lg:px-8 lg:py-5">
        <button
          class="lg:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-text-dim hover:text-text hover:bg-s2 transition-colors flex-shrink-0"
          aria-label="Open menu"
          @click="navOpen = true">
          <Menu class="w-5 h-5" />
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-[16px] lg:text-[18px] font-bold text-text leading-tight truncate">
            {{ pageTitle }}
          </h1>
          <p v-if="pageSubtitle" class="hidden sm:block text-[12.5px] text-text-dim mt-0.5">
            {{ pageSubtitle }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <NuxtLink v-if="canRequest" to="/request" class="btn-primary whitespace-nowrap">
            <Plus class="w-4 h-4" />
            <span class="hidden sm:inline">Request a side meeting</span>
            <span class="sm:hidden">Request</span>
          </NuxtLink>
          <!-- Disabled state carries the reason; on touch it shows on tap-and-hold,
               so the same tooltip markup is kept. -->
          <div v-else class="relative group cursor-not-allowed">
            <button class="btn-primary opacity-50 pointer-events-none whitespace-nowrap" disabled>
              <Plus class="w-4 h-4" />
              <span class="hidden sm:inline">Request a side meeting</span>
              <span class="sm:hidden">Request</span>
            </button>
            <span
              class="pointer-events-none absolute right-0 top-full mt-2 px-3 py-2 rounded-lg bg-s3 border border-border-strong text-text text-xs font-medium text-center max-w-[240px] w-max opacity-0 group-hover:opacity-100 transition-opacity shadow-card z-40">
              {{ requestDisabledReason }}
            </span>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <slot />
      </main>
    </div>

    <!-- Toast notifications -->
    <AdminToast />
  </div>
</template>

<script setup lang="ts">
import {
  Clock,
  CircleCheck,
  CircleX,
  ArrowLeft,
  LayoutGrid,
  ChevronsUpDown,
  LogOut,
  Plus,
  Menu,
  X
} from '@lucide/vue'

// Same useState keys as the admin layout, so pages set their heading the same way.
const pageTitle = useState('page-title', () => 'My side meetings')
const pageSubtitle = useState('page-subtitle', () => '')

const auth = useAuthStore()
const { meeting: myMeeting, counts, load } = useMyBookings()

const userMenuOpen = ref(false)
const userBlockRef = ref<HTMLElement | null>(null)

// Mobile/tablet drawer. Tapping a nav item navigates, so close it on route change.
const navOpen = ref(false)
const route = useRoute()
watch(
  () => route.path,
  () => {
    navOpen.value = false
  }
)

// Same submission-window rules as the public homepage: requests are only open
// for the active meeting, between its open date and the end of its last day.
const requestDisabledReason = computed(() => requestWindowReason(myMeeting.value))
const canRequest = computed(() => !requestDisabledReason.value)

const meetingCity = computed(() => {
  const m = myMeeting.value
  if (!m) return ''
  return m.country ? `${m.city}, ${m.country}` : m.city
})

const userInitials = computed(() => {
  const name = auth.user?.name || ''
  return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
})

async function handleLogout() {
  userMenuOpen.value = false
  await auth.logout()
}

// Close the user menu only when clicking outside the user block, so the toggle
// click that opens it doesn't immediately close it again.
function handleOutsideClick(e: MouseEvent) {
  if (userBlockRef.value && !userBlockRef.value.contains(e.target as Node)) {
    userMenuOpen.value = false
  }
}

onMounted(async () => {
  // The layout only mounts when entering the /manage area, so forcing a reload
  // here picks up newly submitted requests. Navigating between the sections
  // keeps this layout mounted and reuses the shared useState data.
  await load(true)
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.menu-enter-active, .menu-leave-active { transition: all 0.15s; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(4px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
