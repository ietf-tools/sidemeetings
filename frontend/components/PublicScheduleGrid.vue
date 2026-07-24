<template>
  <div ref="rootRef" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-border">
    <div
      v-for="day in columns"
      :key="day.date"
      class="bg-surface p-3 min-w-0 flex flex-col"
      :style="{ maxHeight: dayMaxHeight }">
      <div class="text-center pb-2.5 mb-2.5 border-b border-border flex-shrink-0">
        <div class="text-[15px] font-bold text-text">{{ day.weekday }}</div>
        <div class="text-[11px] text-text-dim">{{ day.dateLabel }}</div>
      </div>

      <div
        v-if="day.items.length"
        class="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">

        <template v-for="(b, i) in day.items" :key="b.id">
          <div
            v-if="b.section !== day.items[i - 1]?.section"
            class="text-center text-[10px] font-bold uppercase tracking-wider text-text-faint pt-1 first:pt-0">
            {{ b.section }}
          </div>

          <div class="group relative" :style="{ color: b.timeColor }">
          <button
            class="w-full text-left rounded-lg px-2.5 py-2 transition-opacity hover:opacity-90"
            :style="b.style"
            @click="$emit('booking-click', b.booking)">
            <div class="text-[12px] font-mono font-semibold opacity-95">{{ b.timeLabel }}</div>
            <div class="text-[13px] font-bold leading-snug text-white">{{ b.booking.title }}</div>
            <div class="text-[11px] opacity-80 truncate">{{ b.booking.roomName }}</div>
            <div v-if="b.badges.length" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="t in b.badges"
                :key="t"
                class="text-[9.5px] font-bold leading-none px-1.5 py-1 rounded bg-black/30 text-white/85">
                {{ t }}
              </span>
            </div>
          </button>

          <!-- Hover actions (desktop only — hidden on touch to avoid accidental taps) -->
          <div
            class="hidden sm:flex absolute top-2 right-2.5 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              class="hover:opacity-70 transition-opacity"
              title="Add to calendar"
              @click.stop="$emit('calendar-click', b.booking)">
              <CalendarPlus class="w-3.5 h-3.5" />
            </button>
            <a
              v-if="b.booking.videoLinkUrl"
              :href="b.booking.videoLinkUrl"
              target="_blank"
              rel="noopener"
              class="hover:opacity-70 transition-opacity"
              title="Join Meeting Call"
              @click.stop>
              <Video class="w-4 h-4" />
            </a>
          </div>
          </div>
        </template>
      </div>
      <div v-else class="text-center text-[11px] text-text-faint py-4">
        No side meetings have<br />been booked yet.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarPlus, Video } from 'lucide-vue-next'

const props = defineProps<{
  meeting: any
  bookings: any[]
  timezone: string
  roomColorMap: Record<string, string>
}>()

defineEmits<{
  'booking-click': [booking: any]
  'calendar-click': [booking: any]
}>()

// Size each day column to the real space between the grid's top and the bottom
// of the viewport, so the columns scroll internally (Trello-style) without the
// whole page needing to scroll. On mobile (stacked, < sm) columns stay natural.
const rootRef = ref<HTMLElement | null>(null)
const dayMaxHeight = ref<string>('')

function updateDayMax() {
  if (typeof window === 'undefined' || !rootRef.value) return
  if (window.innerWidth < 640) {
    dayMaxHeight.value = ''
    return
  }
  const top = rootRef.value.getBoundingClientRect().top + window.scrollY
  const avail = window.innerHeight - top - 24 // leave a small bottom gap
  const next = avail > 240 ? `${avail}px` : ''
  if (next !== dayMaxHeight.value) dayMaxHeight.value = next
}

onMounted(() => {
  nextTick(updateDayMax)
  window.addEventListener('resize', updateDayMax)
})
onUnmounted(() => window.removeEventListener('resize', updateDayMax))

// Recompute when content above/within may have changed the grid's position.
watch(
  () => [props.meeting, props.bookings, props.timezone],
  () => nextTick(updateDayMax)
)

const { getMeetingDays, minutesToTime } = useTemporal()

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const days = computed(() => {
  if (!props.meeting) return []
  return getMeetingDays(props.meeting)
})

// Bookings converted to the selected timezone and grouped into a chronological
// list per day column (agenda style — no time-of-day alignment).
const columns = computed(() => {
  const tz = props.timezone || 'UTC'

  return days.value.map((day) => {
    const items = props.bookings
      .map((b) => {
        try {
          const zdt = Temporal.Instant.from(b.startsAt).toZonedDateTimeISO(tz)
          return {
            booking: b,
            date: zdt.toPlainDate().toString(),
            startMin: zdt.hour * 60 + zdt.minute,
          }
        } catch {
          return null
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.date === day.date)
      .sort((a, b) => a.startMin - b.startMin)
      .map((it) => {
        const hex = props.roomColorMap[it.booking.roomId] || '#2dd4bf'
        const badges = it.booking.isIrtf
          ? ['IRTF']
          : Array.isArray(it.booking.areas)
            ? it.booking.areas
            : []
        const section = it.startMin < 12 * 60 ? 'Morning' : it.startMin < 18 * 60 ? 'Afternoon' : 'Evening'
        return {
          id: it.booking.id,
          booking: it.booking,
          badges,
          section,
          timeLabel: `${minutesToTime(it.startMin)}–${minutesToTime(it.startMin + it.booking.duration)}`,
          timeColor: `color-mix(in srgb, ${hex} 45%, white)`,
          style:
            `background:linear-gradient(to bottom, color-mix(in srgb, ${hex} 32%, var(--surface)), color-mix(in srgb, ${hex} 18%, var(--surface)));` +
            `border:1px solid color-mix(in srgb, ${hex} 55%, transparent);` +
            `border-left:3px solid ${hex};` +
            `color:color-mix(in srgb, ${hex} 45%, white);`,
        }
      })

    const pd = Temporal.PlainDate.from(day.date)
    return {
      date: day.date,
      weekday: WEEKDAYS[pd.dayOfWeek - 1],
      dateLabel: `${MONTHS[pd.month - 1]} ${pd.day}, ${pd.year}`,
      items,
    }
  })
})
</script>
