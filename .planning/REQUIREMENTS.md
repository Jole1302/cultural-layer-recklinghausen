# Requirements: Cultural Layer Recklinghausen

**Defined:** 2026-04-28
**Core Value:** When an artist and a venue both confirm an event, it ships to a clean local feed and visitors actually show up — verified at the door by QR.

**Source of truth:** `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` (SPEC, status APPROVED). Synthesised intel: `.planning/intel/requirements.md`, `.planning/intel/constraints.md`, `.planning/intel/decisions.md`.

**ID convention:** Requirements use the synthesised slug IDs from the ingest pipeline (`REQ-{slug}`) so that ROADMAP.md, plan files, and the intel layer all reference the same handles. Acceptance criteria are reproduced inline (verbatim from intel) so this file is self-contained for downstream planners.

## v1 Requirements

14 requirements. Each maps to exactly one phase (see Traceability).

### Identity & Access

- [ ] **REQ-roles-rbac** — Four user roles with role-based access
  - System supports four roles: `public`, `artist`, `venue`, `admin`. Role stored on `users.role` enum. Admin is provisioned via ENV (single admin in v1).
  - Acceptance:
    - `users.role` enum is `('public', 'artist', 'venue', 'admin')`
    - Exactly one admin in v1; admin creation path is ENV-driven, not signup
    - Role-gated routes: `/artist/*` requires role=artist; `/venue/*` requires role=venue; `/admin/*` requires role=admin; `/me` requires any authenticated role
    - Public anonymous users can read `/`, `/events`, `/events/[slug]`, `/artists/[slug]`, `/venues/[slug]`, `/login`, `/auth/verify`

- [ ] **REQ-magic-link-auth** — Email magic-link authentication
  - Users authenticate via email + magic link delivered by Resend. Token is single-use, 15-minute TTL, hashed in DB.
  - Acceptance:
    - `POST /api/auth/magic-link` accepts an email, rate-limited to 10/min/IP
    - `magic_link_tokens.tokenHash` stores HMAC, not plaintext
    - `expiresAt = now() + 15min`
    - Token invalidated post-use (`consumedAt` set); replay attempts rejected
    - `/auth/verify?token=...` consumes token and establishes session
    - Email-bounce webhook from Resend sets `users.status = 'email_invalid'` and blocks further sends

### Profiles & Media

- [ ] **REQ-profile-uploads** — Profile media uploads via Vercel Blob
  - Artists upload portfolio media; venues upload photos; both via Vercel Blob with signed upload URLs and public-read.
  - Acceptance:
    - Artist `portfolioBlobs` is jsonb `[{url, alt, order}]`
    - Venue `photoBlobs` is jsonb `[{url, alt}]`
    - Event poster: single `posterBlob` URL on both `event_proposals` and `events`
    - Signed-URL TTL on upload; per-user file count limit to bound costs

### Marketplace Lifecycle

- [ ] **REQ-bilateral-marketplace-state-machine** — Bilateral event lifecycle with mutual ACK
  - An `events` row reaches `published` only when both `artistAck=true` AND `venueAck=true`. Either side may initiate (Flow A: artist `event_proposal` → venue invites; Flow B: venue `venue_listing` → artist requests). Admin bootstrap (Flow C) sets both ACKs directly under ENV flag.
  - Acceptance:
    - `events.status` enum: `('proposed', 'published', 'cancelled', 'completed')`
    - DB CHECK: `(status='published') = (artistAck AND venueAck)`
    - Either ACK transition triggers re-evaluation; when both true, status flips to `published` and `publishedAt = now()`
    - Cancellation by either side allowed pre- and post-publish, with email blast to RSVP'ed guests and `tickets.status='cancelled'`
    - Auto-transition to `completed` 24h after `events.startAt` via Vercel scheduled function
    - Suspended user: their `proposed` events freeze; `published` events surface to admin for cancel-or-leave decision
    - Concurrent double-ACK uses `SELECT FOR UPDATE`; both ACK actions logged to audit_log; last-write-wins

- [ ] **REQ-event-proposals** — Artists publish event proposals
  - Artists publish `event_proposals` describing what they want to perform, preferred dates, capacity, and a poster.
  - Acceptance:
    - 2-step wizard at `/artist/proposals/new`: details → dates+capacity+poster
    - Required: `title`, `preferredDates[]`, `capacityWanted`, `posterBlob`
    - Status enum: `('open', 'withdrawn', 'closed')`
    - Catalog visible to venues at `/venue/proposals`, sorted by `createdAt DESC`

- [ ] **REQ-venue-listings** — Venues publish availability listings
  - Venues publish `venue_listings` with available dates and capacity.
  - Acceptance:
    - Form at `/venue/listings/new`
    - Required: `title`, `availableDates[]`
    - Status enum: `('open', 'withdrawn', 'closed')`
    - Catalog visible to artists at `/artist/venues`

### Role Surfaces

- [ ] **REQ-dashboards** — Role-specific dashboards with counters
  - Each non-public role gets a dashboard with counters; venue dashboard adds a calendar view.
  - Acceptance:
    - `/artist`: 4 counters (proposals / drafts / published / completed) + invitations list
    - `/venue`: dashboard + "today" view; `/venue/calendar` monthly calendar
    - `/admin`: summary view

### Discovery & Demand

- [ ] **REQ-public-feed** — Public chronological event feed
  - Public sees only `published` events in chronological order, magazine-style, no filters.
  - Acceptance:
    - `/` shows hero + next 4–6 events
    - When < 2 published events exist, landing flips to waitlist CTA: "Ihr werdet benachrichtigt, wenn das nächste Event live geht"
    - `/events` lists all published events chronologically; no genre/search filters
    - `/events/[slug]` shows details + RSVP CTA
    - Single Kreis-wide feed (no per-city filter)

- [ ] **REQ-rsvp-qr-ticketing** — Free RSVP with QR ticket
  - Public users RSVP free for `published` events; system issues a QR ticket. One ticket per user per event.
  - Acceptance:
    - `tickets` row created with `qrHash` (~22 chars base64url, crypto-random) UNIQUE
    - DB UNIQUE constraint on `(eventId, userId)`
    - INSERT runs in transaction with COUNT against `events.capacity`; reject when full
    - `tickets.status` enum: `('active', 'used', 'cancelled')`
    - User views own tickets at `/me`

### At-Event Flow

- [ ] **REQ-qr-checkin-scanner** — Venue QR scanner with real-time guest list
  - Venues scan QR codes at the door via in-browser camera; real-time guest list updates via 5s polling.
  - Acceptance:
    - `/venue/scan` uses `@zxing/browser` for camera
    - On successful scan: ticket marked `status='used'`, `usedAt=now()`
    - Replay scan returns yellow "Bereits eingecheckt um HH:MM"
    - `/api/tickets/redeem` rate-limited to 50/min/venue
    - `/venue/events/[id]/manage` shows guest list polling every 5s
    - Fallback: manual ticket-code typing when iOS Safari camera fails

### Notifications

- [ ] **REQ-email-notifications** — Transactional email at lifecycle events
  - System sends email at: invite/request received; counterparty confirmed; new RSVP; 24h reminder.
  - Acceptance:
    - Trigger on venue→artist invite and artist→venue request
    - Trigger on second-side ACK (event becomes published)
    - Trigger on each new RSVP (to artist + venue)
    - Trigger 24h before `events.startAt` to all RSVP'd users
    - Global opt-out via footer link (no per-type preferences in v1 — per §14 open question 1)

### Trust & Safety + Operations

- [ ] **REQ-admin-moderation** — Admin backoffice for users, events, audit
  - Admin can suspend/activate users, cancel published events, view audit log, and bootstrap-create seed events behind an ENV flag.
  - Acceptance:
    - `/admin/users` suspend/activate with audit_log entry per action
    - `/admin/events` cancel published events with email blast
    - `/admin/events/new` bootstrap-creates events with both ACKs and `bootstrapped=true`; only enabled when `ENABLE_BOOTSTRAP=true`
    - Cron checks `ENABLE_BOOTSTRAP` after 8 weeks (or 10 published events) and alerts if still on
    - `/admin/audit` lists all audit_log entries

### Cross-cutting Infra

- [ ] **REQ-audit-log** — Audit log on every state change and admin action
  - Every state-change and admin action writes a row to `audit_log` with `(actorUserId, action, target, meta jsonb)`.
  - Acceptance:
    - Actions include but are not limited to: `event.publish`, `event.cancel`, `user.suspend`, `user.activate`, `ticket.redeem`, `ticket.cancel`, `event.bootstrap`
    - System actions write `actorUserId = NULL`
    - Index `audit_log(target, createdAt DESC)`

- [ ] **REQ-quality-bar** — Day-1 quality gates (binding NFRs)
  - Quality bar applies from first deploy; not a "later" item. Mirrored as a top-level requirement so it cannot be deferred.
  - Acceptance (full bullet list — every item is a hard v1 ship gate, derived from CON-quality-nfrs):
    - Test coverage 80% on critical paths (auth, ticket gen/redeem, QR validate, state transitions, RSVP flow)
    - Lighthouse Mobile ≥ 90 on `/`, `/events`, `/events/[slug]`, `/venue/scan`
    - WCAG 2.1 AA from day 1 — contrast ≥ 4.5:1, focus indicators 2px, ARIA labels, full keyboard navigation. Magazine aesthetic layered on a11y-first markup base
    - Sentry from first deploy; P1 alerts to Telegram/email
    - p95 page load < 2s achieved via Cache Components + edge caching
    - Rate limiting: `/api/auth/magic-link` = 10/min/IP; `/api/tickets/redeem` = 50/min/venue
    - Audit log on every state-change and every admin action (overlaps REQ-audit-log; tracked in both)
    - CI gate: typecheck + lint + Vitest unit + Playwright e2e — all green required to merge `main`
    - Secrets management: Vercel ENV only, never in git, separate dev / preview / prod environments
    - GDPR cookie banner from day 1 (Berlin PRD carry-over per §14 open question 4)

## v2 Requirements

Deferred to future release; not in current roadmap. (Mostly enumerated as Out-of-scope below; if any are reclassified to v2 specifically rather than rejected outright, they will be moved here.)

(None tracked separately — see Out of Scope.)

## Out of Scope

Explicitly excluded for v1. From `REQ-out-of-scope-v1` (SPEC §5).

| Feature | Reason |
|---------|--------|
| Stripe / paid tickets / payouts / commission split | v1 is free; no payments overhead until cold-start solved |
| Push notifications (web-push API) | Email covers lifecycle; web-push overkill for v1 traffic |
| Offline-PWA scenarios | install-shell only; offline-first is post-v1 |
| Genre / search filters | ~5 events/month — filters over-engineer and harm density perception (DEC-004) |
| Artist↔venue chat | Minimal `event_messages` table only; no chat UX |
| Reviews / ratings | Premature for cold-start phase |
| Recurring event series | Not in v1 lifecycle |
| Multi-tenant city profiles (Berlin) | Berlin deferred until PMF in Ruhr (DEC-001) |
| SSE / websockets | Polling + SWR sufficient for v1 (DEC-012) |
| Phone-based auth | Magic link only (DEC-008) |
| OAuth (Google / Apple) | Magic link only (DEC-008) |
| Multiple admins | Single ENV-provisioned admin in v1 |
| Subdomain per city | Single Kreis-wide feed (DEC-004) |
| Artist pre-approval gate | Post-hoc moderation only (DEC-005) — low barrier for cold-start |
| Capacity overbook / waitlist | Hard cap at RSVP time (DEC-007) |
| DE+EN i18n | DE only (DEC-006) |

## Constraint References

Constraints from `.planning/intel/constraints.md` are reflected in PROJECT.md → `## Constraints` and consumed by every phase. Listed here for cross-reference:

- **CON-data-model** — 10-table Drizzle schema, day-1 indexes, DB invariants → applied across phases (schema lands in Phase 0; per-table use in feature phases)
- **CON-tech-stack** — locked stack and rejection list → applied in Phase 0 setup; all subsequent phases enforce
- **CON-routes** — ~25 route surface (public/artist/venue/admin) → routes added per phase that owns them
- **CON-state-machine** — event lifecycle protocol → owned by Phase 2
- **CON-quality-nfrs** — 9 day-1 NFRs → REQ-quality-bar in Phase 0; enforced thereafter
- **CON-edge-cases** — 9 mandated error-handling behaviours → woven into the phase that owns the relevant feature
- **CON-cold-start-operational** — in-code parts owned by Phase 4 (waitlist CTA) and Phase 7 (bootstrap flag + cron)
- **CON-spec-context-pointer** — Berlin PRD is context-only; only GDPR cookie banner carry-over (folded into REQ-quality-bar)

## Traceability

Each v1 requirement maps to **exactly one** phase (the phase that delivers it). Cross-cutting requirements are owned by the phase that establishes them; subsequent phases extend without claiming ownership.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-quality-bar | Phase 0 | Pending |
| REQ-audit-log | Phase 0 | Pending |
| REQ-roles-rbac | Phase 1 | Pending |
| REQ-magic-link-auth | Phase 1 | Pending |
| REQ-profile-uploads | Phase 1 | Pending |
| REQ-bilateral-marketplace-state-machine | Phase 2 | Pending |
| REQ-event-proposals | Phase 2 | Pending |
| REQ-venue-listings | Phase 2 | Pending |
| REQ-dashboards | Phase 3 | Pending |
| REQ-public-feed | Phase 4 | Pending |
| REQ-rsvp-qr-ticketing | Phase 4 | Pending |
| REQ-qr-checkin-scanner | Phase 5 | Pending |
| REQ-email-notifications | Phase 6 | Pending |
| REQ-admin-moderation | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓
- Duplicates (REQ in >1 phase): 0 ✓

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 after ingest synthesis (.planning/intel/requirements.md → ROADMAP.md mapping)*
