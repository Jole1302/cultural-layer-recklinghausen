import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  date,
  check,
  unique,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---- Enums (CON-data-model §6) ----
export const userRoleEnum = pgEnum('user_role', ['public', 'artist', 'venue', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'email_invalid']);
export const eventStatusEnum = pgEnum('event_status', [
  'proposed',
  'published',
  'cancelled',
  'completed',
]);
export const proposalStatusEnum = pgEnum('proposal_status', ['open', 'withdrawn', 'closed']);
export const listingStatusEnum = pgEnum('listing_status', ['open', 'withdrawn', 'closed']);
export const ticketStatusEnum = pgEnum('ticket_status', ['active', 'used', 'cancelled']);

// ---- users ----
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('users_email_uq').on(t.email)],
);

// ---- artist_profiles (PK = userId, CASCADE delete) ----
export const artistProfiles = pgTable('artist_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  portfolioBlobs: jsonb('portfolio_blobs').$type<
    Array<{ url: string; alt: string; order: number }>
  >(),
});

// ---- venue_profiles (PK = userId, CASCADE delete) ----
export const venueProfiles = pgTable('venue_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressPostal: text('address_postal'),
  geoLat: numeric('geo_lat'),
  geoLon: numeric('geo_lon'),
  capacity: integer('capacity').notNull(),
  photoBlobs: jsonb('photo_blobs').$type<Array<{ url: string; alt: string }>>(),
  description: text('description'),
});

// ---- event_proposals ----
export const eventProposals = pgTable(
  'event_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    preferredDates: date('preferred_dates').array(),
    capacityWanted: integer('capacity_wanted'),
    posterBlob: text('poster_blob'),
    status: proposalStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('proposals_status_created_idx').on(t.status, t.createdAt.desc())],
);

// ---- venue_listings ----
export const venueListings = pgTable(
  'venue_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    availableDates: date('available_dates').array(),
    status: listingStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('listings_status_created_idx').on(t.status, t.createdAt.desc())],
);

// ---- events (the heart of the marketplace) ----
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => users.id),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => users.id),
    sourceProposalId: uuid('source_proposal_id').references(() => eventProposals.id),
    sourceListingId: uuid('source_listing_id').references(() => venueListings.id),
    title: text('title').notNull(),
    description: text('description'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull(),
    posterBlob: text('poster_blob'),
    status: eventStatusEnum('status').notNull().default('proposed'),
    artistAck: boolean('artist_ack').notNull().default(false),
    venueAck: boolean('venue_ack').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledReason: text('cancelled_reason'),
    bootstrapped: boolean('bootstrapped').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // CRITICAL (Pitfall 2): sql template literals only. Drizzle filter
    // operators emit $1 placeholders Postgres rejects in CHECK constraints.
    check('events_capacity_positive', sql`${t.capacity} > 0`),
    check(
      'events_published_iff_both_ack',
      sql`(${t.status} = 'published') = (${t.artistAck} AND ${t.venueAck})`,
    ),
    index('events_status_start_idx').on(t.status, t.startAt),
    index('events_artist_status_idx').on(t.artistId, t.status),
    index('events_venue_status_idx').on(t.venueId, t.status),
  ],
);

// ---- event_messages ----
export const eventMessages = pgTable('event_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  senderUserId: uuid('sender_user_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- tickets ----
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    qrHash: text('qr_hash').notNull(),
    status: ticketStatusEnum('status').notNull().default('active'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [
    unique('tickets_event_user_uq').on(t.eventId, t.userId),
    unique('tickets_qrhash_uq').on(t.qrHash),
    index('tickets_event_status_idx').on(t.eventId, t.status),
    index('tickets_user_status_idx').on(t.userId, t.status),
  ],
);

// ---- audit_log ----
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id), // nullable = system action
    action: text('action').notNull(),
    target: text('target').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_target_created_idx').on(t.target, t.createdAt.desc())],
);

// ---- magic_link_tokens ----
export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(), // HMAC, never plaintext
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [unique('magic_link_tokenhash_uq').on(t.tokenHash)],
);
