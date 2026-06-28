import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.js'

export const relations = defineRelations(schema, (r) => ({
  bookings: {
    initialOrganizerId: r.one.users({
      from: r.bookings.initialOrganizerId,
      to: r.users.id
    }),
    organizers: r.many.users({
      from: r.bookings.id.through(r.bookingOrganizers.bookingId),
      to: r.users.id.through(r.bookingOrganizers.userId),
    }),
    meeting: r.one.meetings({
      from: r.bookings.meetingId,
      to: r.meetings.id
    }),
    room: r.one.rooms({
      from: r.bookings.roomId,
      to: r.rooms.id
    })
  },
  meetings: {
    bookings: r.many.bookings(),
    rooms: r.many.rooms()
  },
  rooms: {
    meeting: r.one.meetings({
      from: r.rooms.meetingId,
      to: r.meetings.id
    })
  },
  users: {
    bookings: r.many.bookings()
  }
}))