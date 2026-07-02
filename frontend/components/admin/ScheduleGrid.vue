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
          <div class="text-[15px] font-bold text-text">{{ day.weekday }}</div>
          <div class="text-[11px] text-text-dim">{{ day.dateLabel }}</div>
        </div>
      </div>

      <!-- Time rows -->
      <div ref="bodyRef" class="relative">
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

const SLOT_HEIGHT = 24 // content px per 30-min slot
const ROW_BORDER = 1 // 1px bottom border rendered between rows
const ROW_HEIGHT = SLOT_HEIGHT + ROW_BORDER // nominal pitch, used only as a pre-measure fallback
const START_HOUR = 7
const END_HOUR = 23

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const days = computed(() => {
  if (!props.meeting) return []
  // Enrich each day with the full weekday name and long date label to match the
  // public homepage schedule styling.
  return getMeetingDays(props.meeting).map((day) => {
    const pd = Temporal.PlainDate.from(day.date)
    return {
      ...day,
      weekday: WEEKDAYS[pd.dayOfWeek - 1],
      dateLabel: `${MONTHS[pd.month - 1]} ${pd.day}, ${pd.year}`,
    }
  })
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

// Measured top (px, relative to the rows container) of each 30-min row. A 1px
// row border rounds to a fractional device pixel, so the true pitch isn't a
// clean 24 or 25 — extrapolating a constant drifts as you go down. Instead we
// read the actual row positions from the DOM and interpolate against them.
const bodyRef = ref<HTMLElement | null>(null)
const rowTops = ref<number[]>([])

function measureRows() {
  const el = bodyRef.value
  if (!el) return
  const rows = Array.from(el.children).filter((c) =>
    c.classList.contains('grid')
  ) as HTMLElement[]
  rowTops.value = rows.map((r) => r.offsetTop)
}

// Convert a minute-of-day into a pixel offset by interpolating between measured
// row tops (extrapolating past the last row with the average pitch).
function pxForMinute(min: number) {
  const tops = rowTops.value
  const slotF = (min - START_HOUR * 60) / 30
  if (tops.length < 2) return slotF * ROW_HEIGHT
  const last = tops.length - 1
  const pitch = ((tops[last] as number) - (tops[0] as number)) / last
  // Measured top for a (possibly out-of-range) slot index, extrapolating with
  // the average pitch beyond either end.
  const at = (i: number) => {
    if (i < 0) return (tops[0] as number) + i * pitch
    if (i > last) return (tops[last] as number) + (i - last) * pitch
    return tops[i] as number
  }
  const idx = Math.floor(slotF)
  const frac = slotF - idx
  return at(idx) + frac * (at(idx + 1) - at(idx))
}

onMounted(() => {
  nextTick(measureRows)
  if (typeof window !== 'undefined') window.addEventListener('resize', measureRows)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', measureRows)
})
// Re-measure when the grid shape changes (day count / time slots).
watch([() => days.value.length, () => timeSlots.value.length], () => nextTick(measureRows))

function bookingStyle(booking: any) {
  const dayIndex = days.value.findIndex((d) => d.date === booking._date)
  if (dayIndex === -1) return 'display: none;'

  // Interpolate against measured row positions so blocks stay aligned with the
  // time labels regardless of sub-pixel border rounding.
  const topPx = pxForMinute(booking._startMin)
  const heightPx = pxForMinute(booking._startMin + booking.duration) - topPx
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
