# Requirements (synthesized from classified docs)

Requirements derived from PRD-flavoured material in the ingest set. Note: the only ingested doc is a SPEC (`docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md`), but its sections 2 (Personas), 3 (Bilateral lifecycle), 4 (v1 IN scope) and 5 (v1 OUT scope) define the requirement surface for v1. Each requirement below cites that source.

Requirement IDs are stable slugs of the form `REQ-{slug}` for downstream cross-referencing.

---

## REQ-roles-rbac — Four user roles with role-based access

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§2, §4 Roles row, §6 users.role enum)
- **scope:** authn/authz — role model
- **description:** System supports four roles: `public` (visitor), `artist`, `venue` (owner), `admin`. Role is stored on `users.role` enum. Admin account is provisioned via ENV (single admin in v1).
- **acceptance:**
  - `users.role` enum is `('public', 'artist', 'venue', 'admin')`
  - There is exactly one admin in v1; admin creation path is ENV-driven, not signup
  - Role-gated routes: `/artist/*` requires role=artist; `/venue/*` requires role=venue; `/admin/*` requires role=admin; `/me` requires any authenticated role
  - Public anonymous users can read `/`, `/events`, `/events/[slug]`, `/artists/[slug]`, `/venues/[slug]`, `/login`, `/auth/verify`

---

## REQ-magic-link-auth — Email magic-link authentication

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Auth row, §6 magic_link_tokens, §10, §11 magic-link replay row)
- **scope:** authentication
- **description:** Users authenticate via email + magic link delivered by Resend. Token is single-use, 15-minute TTL, hashed in DB.
- **acceptance:**
  - `POST /api/auth/magic-link` accepts an email, rate-limited to 10/min/IP
  - `magic_link_tokens.tokenHash` stores HMAC, not plaintext
  - `expiresAt = now() + 15min`
  - Token is invalidated post-use (`consumedAt` set); replay attempts rejected
  - `/auth/verify?token=...` consumes token and establishes session
  - Email-bounce webhook from Resend sets `users.status = 'email_invalid'` and blocks further sends

---

## REQ-bilateral-marketplace-state-machine — Bilateral event lifecycle with mutual ACK

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§3, §4 Marketplace row, §6 events table, §11 double-ACK race row)
- **scope:** core marketplace state machine
- **description:** An `events` row reaches `published` only when both `artistAck=true` AND `venueAck=true`. Either side can initiate (Flow A: artist `event_proposal` → venue invites; Flow B: venue `venue_listing` → artist requests). Admin bootstrap (Flow C) sets both ACKs directly under ENV flag.
- **acceptance:**
  - `events.status` enum: `('proposed', 'published', 'cancelled', 'completed')`
  - DB CHECK: `(status='published') = (artistAck AND venueAck)`
  - Either ACK transition triggers re-evaluation; when both true, status flips to `published` and `publishedAt = now()`
  - Cancellation by either side allowed pre- and post-publish, with email blast to RSVP'ed guests and `tickets.status='cancelled'`
  - Auto-transition to `completed` 24h after `events.startAt` via Vercel scheduled function
  - Suspended user: their `proposed` events freeze; `published` events surface to admin for cancel-or-leave decision
  - Concurrent double-ACK uses `SELECT FOR UPDATE`; both ACK actions logged to audit_log; last-write-wins

---

## REQ-event-proposals — Artists publish event proposals

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§2 Artist, §3 Flow A, §6 event_proposals)
- **scope:** supply-side: artist offering
- **description:** Artists can publish `event_proposals` describing what they want to perform, preferred dates, capacity, and a poster.
- **acceptance:**
  - 2-step wizard at `/artist/proposals/new`: details → dates+capacity+poster
  - Required: `title`, `preferredDates[]`, `capacityWanted`, `posterBlob`
  - Status enum: `('open', 'withdrawn', 'closed')`
  - Catalog visible to venues at `/venue/proposals`, sorted by `createdAt DESC`

---

## REQ-venue-listings — Venues publish availability listings

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§2 Venue, §3 Flow B, §6 venue_listings)
- **scope:** supply-side: venue offering
- **description:** Venues can publish `venue_listings` with available dates and capacity.
- **acceptance:**
  - Form at `/venue/listings/new`
  - Required: `title`, `availableDates[]`
  - Status enum: `('open', 'withdrawn', 'closed')`
  - Catalog visible to artists at `/artist/venues`

---

## REQ-rsvp-qr-ticketing — Free RSVP with QR ticket

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 RSVP & Check-in rows, §6 tickets, §11 QR replay & capacity overflow rows)
- **scope:** demand-side: ticketing
- **description:** Public users RSVP free for `published` events; system issues a QR ticket. One ticket per user per event.
- **acceptance:**
  - `tickets` row created with `qrHash` (~22 chars base64url, crypto-random) UNIQUE
  - DB UNIQUE constraint on `(eventId, userId)`
  - INSERT runs in transaction with COUNT against `events.capacity`; reject when full
  - `tickets.status` enum: `('active', 'used', 'cancelled')`
  - User views own tickets at `/me`

---

## REQ-qr-checkin-scanner — Venue QR scanner with real-time guest list

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Check-in row, §8 /venue/scan, §10 rate-limit, §11 QR replay & iOS Safari rows)
- **scope:** at-event check-in flow
- **description:** Venues scan QR codes at the door via in-browser camera; real-time guest list updates via 5s polling.
- **acceptance:**
  - `/venue/scan` uses `@zxing/browser` for camera
  - On successful scan: ticket marked `status='used'`, `usedAt=now()`
  - Replay scan returns yellow "Bereits eingecheckt um HH:MM"
  - `/api/tickets/redeem` rate-limited to 50/min/venue
  - `/venue/events/[id]/manage` shows guest list polling every 5s
  - Fallback: manual ticket-code typing when iOS Safari camera fails

---

## REQ-public-feed — Public chronological event feed

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Public feed row, §8 / and /events routes, §9 cold-start)
- **scope:** discovery
- **description:** Public sees only `published` events in chronological order, magazine-style, no filters.
- **acceptance:**
  - `/` shows hero + next 4–6 events
  - When < 2 published events exist, landing flips to waitlist CTA: "Ihr werdet benachrichtigt, wenn das nächste Event live geht"
  - `/events` lists all published events chronologically; no genre/search filters
  - `/events/[slug]` shows details + RSVP CTA
  - Single Kreis-wide feed (no per-city filter)

---

## REQ-dashboards — Role-specific dashboards with counters

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Dashboards row, §8)
- **scope:** signed-in landing pages per role
- **description:** Each non-public role gets a dashboard with counters; venue dashboard adds a calendar view.
- **acceptance:**
  - `/artist`: 4 counters (proposals / drafts / published / completed) + invitations list
  - `/venue`: dashboard + "today" view; `/venue/calendar` monthly calendar
  - `/admin`: summary view

---

## REQ-email-notifications — Transactional email at lifecycle events

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Email row)
- **scope:** transactional email
- **description:** System sends email at: invite/request received; counterparty confirmed; new RSVP; 24h reminder.
- **acceptance:**
  - Trigger on venue→artist invite and artist→venue request
  - Trigger on second-side ACK (event becomes published)
  - Trigger on each new RSVP (to artist + venue)
  - Trigger 24h before `events.startAt` to all RSVP'd users
  - Global opt-out via footer link (no per-type preferences in v1 — see §14 open question 1)

---

## REQ-profile-uploads — Profile media uploads via Vercel Blob

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Profile uploads row, §6 portfolioBlobs/photoBlobs, §12 risk 7)
- **scope:** media storage
- **description:** Artists upload portfolio media; venues upload photos; both via Vercel Blob with signed upload URLs and public-read.
- **acceptance:**
  - Artist `portfolioBlobs` is jsonb `[{url, alt, order}]`
  - Venue `photoBlobs` is jsonb `[{url, alt}]`
  - Event poster: single `posterBlob` URL on both `event_proposals` and `events`
  - Signed-URL TTL on upload; per-user file count limit to bound costs

---

## REQ-admin-moderation — Admin backoffice for users, events, audit

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§2 Admin, §4, §8 admin routes, §9 bootstrap)
- **scope:** trust & safety / admin operations
- **description:** Admin can suspend/activate users, cancel published events, view audit log, and bootstrap-create seed events behind an ENV flag.
- **acceptance:**
  - `/admin/users` suspend/activate with audit_log entry per action
  - `/admin/events` cancel published events with email blast
  - `/admin/events/new` bootstrap-creates events with both ACKs and `bootstrapped=true`; only enabled when `ENABLE_BOOTSTRAP=true`
  - Cron checks `ENABLE_BOOTSTRAP` after 8 weeks (or 10 published events) and alerts if still on
  - `/admin/audit` lists all audit_log entries

---

## REQ-audit-log — Audit log on every state change and admin action

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Audit log row, §6 audit_log, §10)
- **scope:** observability / compliance
- **description:** Every state-change and admin action writes a row to `audit_log` with `(actorUserId, action, target, meta jsonb)`.
- **acceptance:**
  - Actions include but are not limited to: `event.publish`, `event.cancel`, `user.suspend`, `user.activate`, `ticket.redeem`, `ticket.cancel`, `event.bootstrap`
  - System actions write `actorUserId = NULL`
  - Index `audit_log(target, createdAt DESC)`

---

## REQ-quality-bar — Day-1 quality gates

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§4 Quality row, §10 in full)
- **scope:** non-functional quality (covered as constraints; mirrored as a top-level requirement so it cannot be deferred)
- **description:** Quality bar applies from first deploy; not a "later" item.
- **acceptance:** see `constraints.md` § "Quality / NFRs" — every bullet is a hard requirement on v1 ship.

---

## REQ-out-of-scope-v1 — Explicit v1 exclusions

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§5)
- **scope:** scope guard — these are NOT v1 requirements
- **description:** The following are explicitly OUT of v1 and must not be planned into v1 phases. They are listed here so downstream planners can reject scope-creep deterministically.
- **excluded:**
  - Stripe / paid tickets / payouts / commission split
  - Push notifications (web-push API)
  - Offline-PWA scenarios (only install-shell)
  - Genre / search filters
  - Artist↔venue chat (use minimal `event_messages` only)
  - Reviews / ratings
  - Recurring event series
  - Multi-tenant city profiles (Berlin)
  - SSE / websockets
  - Phone-based auth
  - OAuth (Google / Apple)
  - Multiple admins
  - Subdomain per city
  - Artist pre-approval gate
  - Capacity overbook / waitlist
  - DE+EN i18n (DE only)
