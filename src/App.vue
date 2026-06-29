<template>
  <div class="pb-32 bg-sky-900">
    <Disclosure as="nav" class="border-b border-sky-400/25 bg-sky-800" v-slot="{ open }">
      <div class="mx-auto max-w-7xl px-4">
        <div class="relative flex h-16 items-center justify-between">
          <div class="flex items-center px-2 lg:px-0">
            <div class="shrink-0">
              <h1 class="text-xl font-medium tracking-tight text-sky-200">
                <span class="text-white font-bold">IETF {{ state.meeting.meetingNumber }}</span>
                Side Meetings
              </h1>
            </div>
          </div>
          <div class="flex lg:hidden">
            <!-- Mobile menu button -->
            <DisclosureButton
              class="relative inline-flex items-center justify-center rounded-md bg-sky-600 p-2 text-sky-200 hover:bg-sky-500/75 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-white dark:bg-sky-800 dark:hover:bg-sky-700/75">
              <span class="absolute -inset-0.5"></span>
              <span class="sr-only">Open main menu</span>
              <Bars3Icon v-if="!open" class="block size-6" aria-hidden="true" />
              <XMarkIcon v-else class="block size-6" aria-hidden="true" />
            </DisclosureButton>
          </div>
          <div class="hidden lg:ml-4 lg:block">
            <div class="flex items-center">
              <svg
                v-show="state.isLoading"
                class="mr-3 -ml-1 size-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <a
                @click="showPrerequestInfo"
                :disabled="!canRequest"
                tabindex="1"
                :class="[
                  'relative inline-flex items-center gap-x-1.5 rounded-md border-t border-l border-l-white/30 border-t-white/40 px-3 py-2 text-sm font-semibold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
                  canRequest
                    ? 'bg-linear-to-t from-sky-600 to-sky-500 hover:to-sky-400 text-white cursor-pointer'
                    : 'bg-sky-900 text-white/50 line-through cursor-not-allowed pointer-events-none'
                ]">
                <PlusIcon class="-ml-0.5 size-5" aria-hidden="true" />
                Request a Side Meeting
              </a>
            </div>
          </div>
        </div>
      </div>
      <DisclosurePanel class="lg:hidden">
        <!-- Mobile dropdown menu -->
        <div class="border-t border-sky-700 py-4 px-5 dark:border-sky-900">
          <a
            @click="showPrerequestInfo"
            :disabled="!canRequest"
            tabindex="1"
            :class="[
              'relative flex items-center gap-x-1.5 rounded-md border-t border-l border-l-white/30 border-t-white/40 bg-linear-to-t px-3 py-2 text-sm font-semibold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
              canRequest
                ? 'bg-linear-to-t from-sky-600 to-sky-500 hover:to-sky-400 text-white cursor-pointer'
                : 'bg-sky-900 text-white/50 line-through cursor-not-allowed pointer-events-none'
            ]">
            <PlusIcon class="-ml-0.5 size-5" aria-hidden="true" />
            Request a Side Meeting
          </a>
        </div>
      </DisclosurePanel>
    </Disclosure>
    <header class="py-8">
      <div class="mx-auto max-w-7xl px-4">
        <div class="block sm:flex items-center px-2 lg:px-0">
          <div class="grow">
            <h2 class="text-2xl font-semibold tracking-tight text-white">
              {{ state.meeting.meetingLocation }}
            </h2>
            <h2 class="text-xl font-medium tracking-tight text-sky-200">{{ meetingDates }}</h2>
          </div>
          <div class="shrink-0 mt-5 sm:mt-0">
            <div class="flex items-center text-sky-200 text-sm/6">
              <label for="timezone" class="font-semibold">Timezone</label>
              <span class="inline-block pl-2 pr-1">(</span>
              <a
                href="#"
                @click.stop="setTimezone(state.meeting.timezone)"
                class="font-normal text-sky-300 hover:text-white focus-within:text-white"
                >Meeting</a
              >
              <span class="inline-block px-1">&middot;</span>
              <a
                href="#"
                @click.stop="setTimezone()"
                class="font-normal text-sky-300 hover:text-white focus-within:text-white"
                >Local</a
              >
              <span class="inline-block px-1">&middot;</span>
              <a
                href="#"
                @click.stop="setTimezone('Europe/London')"
                class="font-normal text-sky-300 hover:text-white focus-within:text-white"
                >UTC</a
              >
              <span class="inline-block pl-1">)</span>
            </div>
            <div class="grid grid-cols-1">
              <select
                id="timezone"
                name="timezone"
                tabindex="2"
                v-model="state.timezone"
                class="col-start-1 row-start-1 w-full appearance-none rounded-md py-1.5 pr-8 pl-3 text-base outline-1 -outline-offset-1 hover:outline-1 hover:-outline-offset-2 hover:outline-sky-600 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:text-sm/6 bg-white/5 text-white outline-white/10 *:bg-gray-800 focus-visible:outline-sky-500">
                <option v-for="tz of timezones" :key="tz">{{ tz }}</option>
              </select>
              <ChevronDownIcon
                class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end sm:size-4 text-gray-400"
                aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </header>
  </div>

  <main class="-mt-32">
    <div class="mx-auto max-w-7xl px-4 pb-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1">
        <div
          class="bg-sky-950 rounded-md px-2 py-2 shadow-xl outline-1 -outline-offset-1 outline-white/10"
          v-for="day of days"
          :key="day.id">
          <h3 class="font-semibold text-white text-center">{{ day.name }}</h3>
          <div
            class="text-sm/tight font-medium text-sky-300 border-b border-gray-400/25 pb-2 text-center">
            {{ day.dateLabel }}
          </div>
          <div class="grid grid-cols-1 gap-2 mt-2">
            <div
              v-if="day.bookings.length < 1"
              class="bg-black/10 rounded-sm px-2 py-20 text-center italic text-sm text-sky-200/80">
              No side meetings have been booked yet.
            </div>
            <div
              v-for="booking of day.bookings"
              :key="booking.id"
              @click="showDetails(booking)"
              :tabindex="booking.orderIdx + 3"
              :class="
                'rounded-sm p-2 text-sm border-l border-t border-white/30 shadow hover:outline-2 hover:outline-offset-2 hover:outline-sky-200/80 focus:outline-2 focus:outline-offset-2 focus:outline-sky-200/80 cursor-pointer ' +
                booking.room.bgColor
              ">
              <div :class="booking.room.textColor + ' font-semibold'">
                {{ booking.timeDisplay }}
              </div>
              <div class="font-bold">{{ booking.roomName }}</div>
              <div>{{ booking.title }}</div>
              <div
                v-if="booking.areas.length > 0"
                class="flex flex-wrap gap-1 mt-1 text-xs text-white/90">
                <div
                  v-for="area of booking.areas"
                  :key="area"
                  class="bg-black/40 px-1 py-px rounded">
                  {{ area }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="state.bookings.length > 0"
        class="text-center mt-5 text-sm text-sky-200 sm:flex justify-center items-center gap-x-1.5">
        <a
          href="#"
          class="relative inline-flex items-center gap-x-1.5 justify-center rounded-md border-t border-l border-white/30 bg-emerald-700 hover:bg-emerald-600 px-3 py-0.5 sm:py-1 text-sm text-emerald-100"
          @click.stop.prevent="addToCalendar(true)">
          <CalendarDaysIcon class="-ml-0.5 size-4" aria-hidden="true" />
          Add all to calendar
          <small class="bg-emerald-900 text-emerald-100 rounded px-1 py-0.5 ml-0.5">.ics</small>
        </a>
        or click on a single event above to view the details / download that specific event .ics
        file.
      </div>
    </div>
  </main>

  <TransitionRoot appear :show="state.detailsShown" as="template">
    <Dialog as="div" @close="closeDetails" class="relative z-10">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0">
        <div class="fixed inset-0 bg-black/75"></div>
      </TransitionChild>
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95">
            <DialogPanel
              class="w-full max-w-xl relative transform overflow-hidden rounded-2xl text-white text-left align-middle shadow-xl transition-all bg-gray-900">
              <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  class="rounded-mdfocus:outline-2 focus:outline-offset-2 bg-gray-800 hover:text-gray-300 focus:outline-white cursor-pointer"
                  @click="closeDetails">
                  <span class="sr-only">Close</span>
                  <XMarkIcon class="size-6" aria-hidden="true" />
                </button>
              </div>
              <div class="bg-gray-800 p-6">
                <div class="text-sm font-medium text-sky-200">
                  {{ state.details.dayDisplay }}
                </div>
                <DialogTitle as="h3" class="text-lg font-semibold text-white">{{
                  state.details.title
                }}</DialogTitle>
                <DialogDescription
                  as="div"
                  :class="state.details.room.textColor + ' font-semibold mt-2'">
                  <div>
                    {{ state.details.timeDisplay }}
                    <span class="text-sm font-normal tracking-tight">( {{ state.timezone }} )</span>
                    &middot;
                    {{ state.details.roomName }}
                  </div>
                </DialogDescription>
                <div class="mt-4 text-sm">{{ state.details.description }}</div>
                <div v-if="!state.details.isUnavailable" class="flex items-center mt-4 text-sm">
                  <span class="font-semibold mr-2">Organizer:</span>
                  <span
                    >{{ state.details.organizerName }} &middot;
                    <a
                      class="text-sky-300 hover:text-sky-200"
                      :href="'mailto:' + state.details.organizerEmail"
                      >{{ state.details.organizerEmail }}</a
                    >
                  </span>
                </div>
                <div
                  v-if="state.details.areas.length > 0"
                  class="flex items-center flex-wrap gap-1 mt-3 text-sm">
                  <span class="font-semibold mr-2">Areas:</span>
                  <div
                    v-for="area of state.details.areas"
                    :key="area"
                    class="bg-black/40 px-1 py-px rounded text-xs text-white/90">
                    {{ area }}
                  </div>
                </div>
              </div>
              <div class="px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 bg-gray-900">
                <a
                  v-if="!state.details.isUnavailable"
                  class="relative inline-flex items-center gap-x-1.5 w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-xs sm:ml-3 sm:w-auto bg-sky-600 hover:bg-sky-500 cursor-pointer"
                  :href="state.details.location"
                  target="_blank">
                  <VideoCameraIcon class="-ml-0.5 size-5" aria-hidden="true" />
                  Join Meeting Call
                </a>
                <a
                  v-if="!state.details.isUnavailable"
                  class="relative inline-flex items-center gap-x-1.5 w-full justify-center rounded-md px-3 py-2 mt-3 sm:mt-0 text-sm font-semibold text-white shadow-xs sm:ml-3 sm:w-auto bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                  @click="addToCalendar(false)"
                  target="_blank">
                  <CalendarDaysIcon class="-ml-0.5 size-5" aria-hidden="true" />
                  Add to Calendar
                  <small class="bg-emerald-800 text-emerald-100 rounded px-1 py-0.5 ml-0.5"
                    >.ics</small
                  >
                </a>
                <button
                  type="button"
                  class="relative inline-flex items-center gap-x-1.5 w-full justify-center rounded-md px-3 py-2 mt-3 sm:mt-0 text-sm font-semibold shadow-xs inset-ring sm:w-auto bg-white/10 text-white inset-ring-white/5 hover:bg-white/20 cursor-pointer"
                  @click="closeDetails">
                  <XMarkIcon class="-ml-0.5 size-5" aria-hidden="true" />
                  Close
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

  <TransitionRoot appear :show="state.prerequestInfoShown" as="template">
    <Dialog as="div" @close="closePrerequestInfo" class="relative z-10">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0">
        <div class="fixed inset-0 bg-black/75"></div>
      </TransitionChild>
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95">
            <DialogPanel
              class="w-full max-w-xl relative transform overflow-hidden rounded-2xl text-white text-left align-middle shadow-xl transition-all bg-gray-900">
              <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  class="rounded-mdfocus:outline-2 focus:outline-offset-2 bg-gray-800 hover:text-gray-300 focus:outline-white cursor-pointer"
                  @click="closePrerequestInfo">
                  <span class="sr-only">Close</span>
                  <XMarkIcon class="size-6" aria-hidden="true" />
                </button>
              </div>
              <div class="bg-gray-800 p-6">
                <DialogTitle as="h3" class="text-lg font-semibold text-white"
                  >Request a Side Meeting</DialogTitle
                >
                <DialogDescription as="div" class="mt-4 text-sm">
                  <div>
                    Note that only a single host can be specified when requesting a side meeting.
                    Any additional may be added in the meeting description.
                  </div>
                  <div class="mt-4">
                    Any edits after submission will need to be made by the secretariat.
                  </div>
                  <div class="mt-4">
                    <strong>Note that the Grand Klimt Hall 3 room is fully booked and no longer available.</strong>
                  </div>
                </DialogDescription>
              </div>
              <div class="px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 bg-gray-900">
                <a
                  class="relative inline-flex items-center gap-x-1.5 w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-xs sm:ml-3 sm:w-auto bg-sky-600 hover:bg-sky-500 cursor-pointer"
                  href="https://ietf.cal.com/side-meetings"
                  target="_blank"
                  @click="closePrerequestInfo">
                  <ArrowRightCircleIcon class="-ml-0.5 size-5" aria-hidden="true" />
                  Continue
                </a>
                <button
                  type="button"
                  class="relative inline-flex items-center gap-x-1.5 w-full justify-center rounded-md px-3 py-2 mt-3 sm:mt-0 text-sm font-semibold shadow-xs inset-ring sm:w-auto bg-white/10 text-white inset-ring-white/5 hover:bg-white/20 cursor-pointer"
                  @click="closePrerequestInfo">
                  <XMarkIcon class="-ml-0.5 size-5" aria-hidden="true" />
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogDescription,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  TransitionRoot,
  TransitionChild
} from '@headlessui/vue'
import {
  ArrowRightCircleIcon,
  Bars3Icon,
  CalendarDaysIcon,
  VideoCameraIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { PlusIcon } from '@heroicons/vue/20/solid'
import { ChevronDownIcon } from '@heroicons/vue/16/solid'
import { computed, reactive } from 'vue'
import { DateTime } from 'luxon'
import ical from 'ical-generator'

const state = reactive({
  isLoading: false,
  meeting: {
    meetingNumber: '---',
    meetingLocation: '---',
    startDate: DateTime.fromISO('2000-01-01'),
    endDate: DateTime.fromISO('2000-01-02'),
    timezone: 'America/New_York',
    canRequestStartDateTime: DateTime.fromISO('2000-01-01:00:00:00Z')
  },
  rooms: [],
  bookings: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  detailsShown: false,
  prerequestInfoShown: false,
  firstFetch: true,
  details: {}
})

const timezones = Intl.supportedValuesOf('timeZone')

const canRequest = computed(() => {
  const now = DateTime.now()
  return now >= state.meeting.canRequestStartDateTime && now <= state.meeting.endDate
})

const meetingDates = computed(() => {
  const start = state.meeting.startDate.setZone(state.timezone)
  const end = state.meeting.endDate.setZone(state.timezone)
  if (start.month === end.month) {
    return `${start.toFormat('MMMM d')} - ${end.toFormat('d, y')}`
  } else {
    return `${start.toFormat('MMMM d')} - ${end.toFormat('MMMM d, y')}`
  }
})

const days = computed(() => {
  let tempDays = []
  let day = state.meeting.startDate.setZone(state.timezone)
  while (day < state.meeting.endDate) {
    const dayStart = day.setZone(state.timezone).startOf('day')
    const dayEnd = day.setZone(state.timezone).endOf('day')
    tempDays.push({
      id: day.toISODate(),
      name: day.weekdayLong,
      dateLabel: day.toFormat('LLLL d, yyyy'),
      bookings: state.bookings
        .filter((b) => b.start >= dayStart && b.start <= dayEnd)
        .map((b) => ({
          ...b,
          room: b.isUnavailable
            ? {
                ...b.room,
                bgColor: `bg-slate-700 text-slate-300 border-t-2 ${b.room.borderColor}`,
                textColor: 'text-slate-200'
              }
            : b.room,
          start: b.start.setZone(state.timezone),
          end: b.end.setZone(state.timezone),
          timeDisplay: `${b.start.setZone(state.timezone).toFormat('H:mm')}-${b.end.setZone(state.timezone).toFormat('H:mm')}`
        }))
    })
    day = day.plus({ days: 1 })
  }
  return tempDays
})

const bgColors = [
  'bg-linear-to-t from-sky-800 to-sky-700 text-white',
  'bg-linear-to-t from-yellow-700 to-yellow-600 text-white',
  'bg-purple-800 text-white',
  'bg-emerald-800 text-white',
  'bg-indigo-800 text-white',
  'bg-sky-800 text-white'
]
const textColors = [
  'text-sky-200',
  'text-yellow-100',
  'text-purple-200',
  'text-emerald-200',
  'text-indigo-200',
  'text-sky-200'
]
const borderColors = [
  'border-t-sky-500',
  'border-t-yellow-600',
  'border-t-purple-200',
  'border-t-emerald-200',
  'border-t-indigo-200',
  'border-t-sky-200'
]

/**
 * Set new display timezone
 *
 * @param {string} newTz Timezone
 */
function setTimezone(newTz) {
  state.timezone = newTz || Intl.DateTimeFormat().resolvedOptions().timeZone
  return false
}

/**
 * Close event details modal
 */
function closeDetails() {
  state.detailsShown = false
}

/**
 * Close Pre-request Info modal
 */
function closePrerequestInfo() {
  state.prerequestInfoShown = false
}

/**
 * Generate ICS
 *
 * @param {Boolean} all Add all sidemeetings to ics when true
 */
function addToCalendar(all = false) {
  const calendar = ical({ name: 'IETF Side Meetings' })

  if (all) {
    if (state.bookings.length < 1) {
      return window.alert('Cannot generate .ics file because no side meeting has been booked yet.')
    }
    for (const booking of state.bookings.filter((b) => !b.isUnavailable)) {
      calendar.createEvent({
        summary: booking.title,
        description: booking.description + '\n\n' + booking.location,
        start: booking.start,
        end: booking.end,
        location: booking.roomName,
        url: window.location.href,
        timezone: state.meeting.timezone,
        organizer: {
          email: booking.organizerEmail,
          name: booking.organizerName
        }
      })
    }

    initiateCalDownload(calendar.toString(), 'sidemeetings.ics')
  } else {
    calendar.createEvent({
      summary: state.details.title,
      description: state.details.description + '\n\n' + state.details.location,
      start: state.details.start,
      end: state.details.end,
      location: state.details.roomName,
      url: window.location.href,
      timezone: state.meeting.timezone,
      organizer: {
        email: state.details.organizerEmail,
        name: state.details.organizerName
      }
    })

    initiateCalDownload(calendar.toString(), 'sidemeeting.ics')
  }
}

/**
 * Trigger ICS Download
 *
 * @param contents ICS contents
 * @param fileName Suggested Download Filename
 */
function initiateCalDownload(contents, fileName) {
  const calBlob = new Blob([contents], { type: 'text/calendar; charset=utf-8' })
  let calA = document.createElement('a')
  calA.download = fileName
  calA.href = URL.createObjectURL(calBlob)
  calA.dataset.downloadurl = ['text/calendar', calA.download, calA.href].join(':')
  calA.style.display = 'none'
  document.body.appendChild(calA)
  calA.click()
  document.body.removeChild(calA)
}

/**
 * Display event details modal
 *
 * @param {Object} booking Event details
 */
function showDetails(booking) {
  state.details = {
    ...booking,
    dayDisplay: booking.start.toFormat('cccc, LLLL d, yyyy')
  }
  state.detailsShown = true
}

/**
 * Display event details modal
 */
function showPrerequestInfo() {
  state.prerequestInfoShown = true
}

/**
 * Fetch sidemeetings from server
 */
async function fetchData() {
  if (state.isLoading) {
    return
  }
  state.isLoading = true
  try {
    const resp = await fetch('/_data').then((r) => r.json())
    if (state.firstFetch) {
      state.timezone = resp.meeting.timezone
      state.firstFetch = false
    }
    state.meeting = {
      ...resp.meeting,
      startDate: DateTime.fromISO(resp.meeting.startDate, { zone: resp.meeting.timezone }),
      endDate: DateTime.fromISO(resp.meeting.endDate, { zone: resp.meeting.timezone }).endOf('day'),
      canRequestStartDateTime: DateTime.fromISO(resp.meeting.canRequestStartDateTime)
    }
    state.rooms = resp.rooms.map((r, rIdx) => {
      return {
        ...r,
        bgColor: bgColors[rIdx] ?? 'bg-sky-800',
        textColor: textColors[rIdx] ?? 'text-sky-200',
        borderColor: borderColors[rIdx] ?? 'border-sky-200'
      }
    })
    state.bookings = resp.bookings.map((b, idx) => {
      const start = DateTime.fromISO(b.start, { zone: state.meeting.timezone })
      const end = DateTime.fromISO(b.end, { zone: state.meeting.timezone })
      return {
        ...b,
        start,
        end,
        timeDisplay: `${start.toFormat('H:mm')}-${end.toFormat('H:mm')}`,
        room: state.rooms.find((r) => r.id === b.roomId),
        isUnavailable: b.title.toLowerCase() === 'unavailable',
        orderIdx: idx
      }
    })
  } catch (err) {
    console.warn(err)
  }
  state.isLoading = false
}

setInterval(fetchData, 60000)
fetchData()
</script>
