<template>
  <div class="overflow-auto">
    <div class="min-w-[640px]">
      <!-- Day headers -->
      <div class="grid border-b border-border" :style="gridStyle">
        <div class="w-14 flex-shrink-0"></div>
        <div
          v-for="day in days"
          :key="day.date"
          class="text-center py-2.5 border-l border-border"
        >
          <div class="text-xs font-semibold text-text-dim uppercase tracking-wider">{{ day.label.split(' ')[0] }}</div>
          <div class="font-mono text-xs text-text mt-0.5">{{ day.label.split(' ')[1] }}</div>
        </div>
      </div>

      <!-- Time rows -->
      <div class="relative">
        <div
          v-for="(slot, si) in timeSlots"
          :key="slot.value"
          class="grid border-b border-border last:border-0"
          :style="gridStyle"
        >
          <!-- Time label -->
          <div class="w-14 flex-shrink-0 flex items-start justify-end pr-2 pt-0.5">
            <span v-if="slot.isHour" class="text-[10px] font-mono text-text-faint">{{ slot.label }}</span>
          </div>

          <!-- Day cells: two stacked 15-min sub-cells so closed/open shading
               matches the 15-min booking granularity, not just 30-min steps. -->
          <div
            v-for="day in days"
            :key="day.date"
            class="border-l border-border relative"
            style="height: 24px;"
          >
            <div
              v-for="sub in slot.subSlots"
              :key="sub"
              :class="isClosed(day, { value: sub }) ? 'cell-closed' : ''"
              style="height: 12px;"
            ></div>
          </div>
        </div>

        <!-- Booking blocks overlay -->
        <div
          v-for="booking in visibleBookings"
          :key="booking.id"
          class="absolute rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden transition-opacity hover:opacity-90 flex flex-col justify-start"
          :style="bookingStyle(booking)"
          @click="$emit('booking-click', booking.id)"
        >
          <div class="text-[12px] font-semibold leading-tight truncate">{{ booking.title }}</div>
          <div class="text-[11px] opacity-80 font-mono">{{ minutesToTime(booking._startMin) }}–{{ minutesToTime(booking._startMin + booking.duration) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  room: any
  meeting: any
  bookings: any[]
}>()

defineEmits<{
  'booking-click': [id: string]
}>()

const { getMeetingDays, minutesToTime } = useTemporal()

const SLOT_HEIGHT = 24 // px per 30-min slot
const START_HOUR = 7
const END_HOUR = 23

const days = computed(() => {
  if (!props.meeting) return []
  return getMeetingDays(props.meeting)
})

const gridStyle = computed(() => {
  const cols = days.value.length
  return `grid-template-columns: 3.5rem repeat(${cols}, 1fr);`
})

const timeSlots = computed(() => {
  const slots = []
  for (let m = START_HOUR * 60; m < END_HOUR * 60; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push({
      value: m,
      // 15-min sub-slots within this 30-min row, shaded independently.
      subSlots: [m, m + 15],
      label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      isHour: min === 0,
    })
  }
  return slots
})

const visibleBookings = computed(() => {
  if (!props.room || !props.meeting) return []
  const tz = props.meeting.timezone || 'UTC'
  return props.bookings
    .filter((b) => b.roomId === props.room.id && (b.state === 'confirmed' || b.state === 'pending'))
    .map((b) => {
      try {
        const zdt = Temporal.Instant.from(b.startsAt).toZonedDateTimeISO(tz)
        return { ...b, _date: zdt.toPlainDate().toString(), _startMin: zdt.hour * 60 + zdt.minute }
      } catch {
        return null
      }
    })
    .filter(Boolean)
})

function isClosed(day: { date: string; offset: number }, slot: { value: number }) {
  if (!props.room?.availability) return true
  const avail = Array.isArray(props.room.availability) ? props.room.availability : []
  const periods: { s: number; e: number }[] = avail[day.offset] || []
  return !periods.some((p) => slot.value >= p.s && slot.value < p.e)
}

function bookingStyle(booking: any) {
  const dayIndex = days.value.findIndex((d) => d.date === booking._date)
  if (dayIndex === -1) return 'display: none;'

  const startOffset = booking._startMin - START_HOUR * 60
  const topPx = (startOffset / 30) * SLOT_HEIGHT
  const heightPx = (booking.duration / 30) * SLOT_HEIGHT
  const colWidth = `calc((100% - 3.5rem) / ${days.value.length})`
  const leftOffset = `calc(3.5rem + ${dayIndex} * ${colWidth} + 1px)`
  const bg = booking.state === 'confirmed' ? '#166534' : '#78350f'
  const color = booking.state === 'confirmed' ? '#bbf7d0' : '#fef3c7'
  const border = booking.state === 'confirmed' ? 'rgba(52,211,153,.3)' : 'rgba(227,169,59,.3)'

  return `
    position: absolute;
    top: ${topPx}px;
    left: ${leftOffset};
    width: calc(${colWidth} - 2px);
    height: ${Math.max(heightPx - 2, 18)}px;
    background: ${bg};
    color: ${color};
    border: 1px solid ${border};
    z-index: 10;
    padding: 2px 6px;
  `
}
</script>
