interface MyBooking {
  id: string
  roomId: string
  roomName: string
  roomColor: string
  title: string
  description: string | null
  // Proposed description waiting on admin approval; null when none is pending.
  pendingDescription: string | null
  pendingDescriptionAt: string | null
  state: 'pending' | 'confirmed' | 'rejected' | 'cancelled'
  isIrtf: boolean
  areas: string[]
  coOrganizers: { name: string; email: string }[]
  startsAt: string
  duration: number
  endsAt: string | null
  videoLinkUrl: string | null
  videoLinkName: string | null
  createdAt: string
  updatedAt: string
}

interface MyMeeting {
  id: string
  num: string
  city: string
  country: string
  venue: string
  timezone: string
  startDate: string
  endDate: string
  isActive: boolean
}

/**
 * The signed-in user's own bookings for the active meeting, shared between the
 * /manage layout (which needs the pending badge count) and its pages via a
 * single useState entry, so switching sections doesn't refetch.
 */
export function useMyBookings() {
  const bookings = useState<MyBooking[]>('my-bookings', () => [])
  const meeting = useState<MyMeeting | null>('my-bookings-meeting', () => null)
  const loading = useState('my-bookings-loading', () => false)
  const loaded = useState('my-bookings-loaded', () => false)

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const data = await useApiFetch<{ meeting: MyMeeting | null; bookings: MyBooking[] }>(
        '/my/bookings'
      )
      meeting.value = data.meeting
      bookings.value = data.bookings ?? []
      loaded.value = true
    } catch {
      meeting.value = null
      bookings.value = []
    } finally {
      loading.value = false
    }
  }

  function byState(state: MyBooking['state']) {
    return computed(() => bookings.value.filter((b) => b.state === state))
  }

  const counts = computed(() => ({
    pending: bookings.value.filter((b) => b.state === 'pending').length,
    confirmed: bookings.value.filter((b) => b.state === 'confirmed').length,
    // Cancelled requests are listed alongside rejected ones: both are dead ends
    // for the organizer, and neither has a section of its own.
    rejected: bookings.value.filter((b) => b.state === 'rejected' || b.state === 'cancelled')
      .length
  }))

  return { bookings, meeting, loading, loaded, load, byState, counts }
}

export type { MyBooking, MyMeeting }
