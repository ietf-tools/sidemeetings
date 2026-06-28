import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

// == TABLES ===========================

// MEETINGS ----------------------------
export const meetings = pgTable('meetings', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  timezone: varchar({ length: 255 }).notNull(),
  startDate: date().notNull(),
  endDate: date().notNull(),
  allowRequestsFrom: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// ROOMS -------------------------------
export const rooms = pgTable('rooms', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  description: text().notNull(),
  color: varchar({ length: 255 }).notNull(),
  banner: text().notNull(), // markdown
  durations: integer().array().notNull().default([]), // in minutes
  defaultDuration: integer().notNull().default(0), // in minutes
  bufferBeforeEvent: integer().notNull().default(0), // in minutes
  bufferAfterEvent: integer().notNull().default(0), // in minutes
  minimumNotice: integer().notNull().default(0), // in minutes
  videoLinkUrl: varchar({ length: 2048 }).notNull(),
  videoLinkName: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  meetingId: uuid()
    .notNull()
    .references(() => meetings.id)
})

// USERS -------------------------------
export const users = pgTable('users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }).notNull().unique(),
    name: varchar({ length: 255 }).notNull(),
    authUserId: varchar({ length: 255 }),
    isActive: boolean().notNull().default(false),
    isAdmin: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow()
  }
)

// BOOKINGS ----------------------------
export const bookingStateEnum = pgEnum('bookingState', ['pending', 'confirmed', 'cancelled'])
export const bookings = pgTable('bookings', {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar({ length: 255 }).notNull(),
  state: bookingStateEnum().notNull().default('pending'),
  description: text().notNull(),
  data: jsonb().notNull().default({}),
  startsAt: timestamp().notNull(),
  endsAt: timestamp('endsAt').generatedAlwaysAs(
    () => sql`${bookings.startsAt} + (${bookings.duration} * INTERVAL '1 minute')`
  ),
  duration: integer().notNull().default(0), // in minutes
  videoLinkUrl: varchar({ length: 2048 }).notNull(),
  videoLinkName: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  meetingId: uuid()
    .notNull()
    .references(() => meetings.id),
  roomId: uuid()
    .notNull()
    .references(() => rooms.id),
  initialOrganizerId: uuid()
    .notNull()
    .references(() => users.id)
})

// == RELATION TABLES ==================

// BOOKING ORGANIZERS ------------------
export const bookingOrganizers = pgTable(
  'bookingOrganizers',
  {
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.bookingId, table.userId] }),
    index('userGroups_bookingId_idx').on(table.bookingId),
    index('userGroups_userId_idx').on(table.userId),
    index('userGroups_composite_idx').on(table.bookingId, table.userId)
  ]
)