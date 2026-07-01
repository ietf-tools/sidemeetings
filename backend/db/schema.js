import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  index
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const bookingStateEnum = pgEnum('booking_state', [
  'pending',
  'confirmed',
  'rejected',
  'cancelled'
])

export const activityKindEnum = pgEnum('activity_kind', [
  'submitted',
  'confirmed',
  'rejected',
  'cancelled',
  'updated'
])

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  num: varchar('num', { length: 10 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  country: varchar('country', { length: 255 }).notNull(),
  venue: varchar('venue', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 100 }).notNull(), // IANA timezone
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  allowRequestsFrom: timestamp('allow_requests_from'),
  isActive: boolean('is_active').notNull().default(false),
  buffer: integer('buffer').notNull().default(15), // minutes between bookings
  minNotice: integer('min_notice').notNull().default(60), // minutes before slot
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    capacity: integer('capacity').notNull().default(0),
    color: varchar('color', { length: 50 }).notNull().default('sky'),
    // availability: array of 5 elements (Mon–Fri), each is array of {s, e} window objects (minutes since midnight)
    availability: jsonb('availability').notNull().default([[], [], [], [], []]),
    videoLinkUrl: varchar('video_link_url', { length: 2048 }),
    videoLinkName: varchar('video_link_name', { length: 255 }).default('Webex'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [index('rooms_meeting_id_idx').on(table.meetingId)]
)

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  authUserId: varchar('auth_user_id', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true), // false = blocked
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    state: bookingStateEnum('state').notNull().default('pending'),
    isIrtf: boolean('is_irtf').notNull().default(false),
    areas: varchar('areas', { length: 10 })
      .array()
      .notNull()
      .default(sql`'{}'::varchar[]`),
    coOrganizers: jsonb('co_organizers').notNull().default([]),
    startsAt: timestamp('starts_at').notNull(),
    duration: integer('duration').notNull(), // minutes
    endsAt: timestamp('ends_at').generatedAlwaysAs(
      sql`"starts_at" + ("duration" * INTERVAL '1 minute')`
    ),
    videoLinkUrl: varchar('video_link_url', { length: 2048 }),
    videoLinkName: varchar('video_link_name', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('bookings_meeting_id_idx').on(table.meetingId),
    index('bookings_room_id_idx').on(table.roomId),
    index('bookings_organizer_id_idx').on(table.organizerId),
    index('bookings_state_idx').on(table.state)
  ]
)

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  fromEmail: varchar('from_email', { length: 255 }),
  replyTo: varchar('reply_to', { length: 255 }),
  approvers: varchar('approvers', { length: 255 })
    .array()
    .notNull()
    .default(sql`'{}'::varchar[]`),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Server-side session store (see lib/sessionStore.js) so logins survive backend
// restarts and redeploys. `sess` holds the serialized @fastify/session object;
// `expire` is indexed for cheap pruning of stale rows.

export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid', { length: 255 }).primaryKey(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire').notNull()
  },
  (table) => [index('sessions_expire_idx').on(table.expire)]
)

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    action: activityKindEnum('action').notNull(),
    meta: jsonb('meta').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [index('activity_log_created_at_idx').on(table.createdAt)]
)
