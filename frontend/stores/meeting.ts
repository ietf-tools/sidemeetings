import { defineStore } from 'pinia'

interface Meeting {
  id: string
  num: string
  city: string
  country: string
  venue: string
  startDate: string
  endDate: string
  timezone: string
  allowRequestsFrom: string | null
  buffer: number
  minNotice: number
  isActive: boolean
  roomCount?: number
  bookingCount?: number
}

export const useMeetingStore = defineStore('meeting', {
  state: () => ({
    activeMeeting: null as Meeting | null,
    viewingMeeting: null as Meeting | null,
    meetings: [] as Meeting[],
  }),

  actions: {
    async fetchMeetings() {
      try {
        const config = useRuntimeConfig()
        const data = await $fetch<Meeting[]>(config.public.apiUrl + '/meetings', {
          credentials: 'include',
        })
        this.meetings = data
        const active = data.find((m) => m.isActive)
        if (active) {
          this.activeMeeting = active
          if (!this.viewingMeeting) {
            this.viewingMeeting = active
          }
        }
      } catch {
        // ignore
      }
    },

    setViewingMeeting(meeting: Meeting) {
      this.viewingMeeting = meeting
    },

    setActiveMeeting(id: string) {
      const meeting = this.meetings.find((m) => m.id === id)
      if (meeting) {
        this.activeMeeting = meeting
      }
    },
  },
})
