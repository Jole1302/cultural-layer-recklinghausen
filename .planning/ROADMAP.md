# Roadmap: Cultural Layer Recklinghausen

## Overview

A 14-requirement / 8-phase v1 that delivers a bilateral event marketplace for Kreis Recklinghausen. Phase 0 stands up the production-grade skeleton (locked stack, CI gates, monitoring, audit infrastructure) so that quality is enforced from the first commit, not bolted on later. Phases 1–2 establish identity and the marketplace lifecycle that everything else depends on. Phases 3–5 deliver the role-specific surfaces (dashboards, public feed + RSVP, venue check-in scanner) that make the lifecycle observable to humans. Phase 6 adds the transactional email layer that nudges both supply and demand. Phase 7 ships the admin backoffice plus the in-code parts of the cold-start launch policy. Granularity = `standard`. Phase shape was suggested by HANDOFF.md but validated against the requirement-dependency graph independently — the 8 boundaries follow the natural seams of the 14 REQ-*.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, …): Planned milestone work
- Decimal phases (e.g., 2.1): Reserved for urgent insertions (none yet)

- [x] **Phase 0: Skeleton & Infra** — Locked stack scaffolded, schema migrated, CI/Sentry/audit infrastructure live (REQ-quality-bar + REQ-audit-log) — completed 2026-05-04
- [ ] **Phase 1: Auth & Profiles** — Magic-link login, role-gated routes, artist/venue profile editors with Vercel Blob uploads
- [ ] **Phase 2: Marketplace State Machine** — Bilateral mutual-ACK lifecycle, event_proposals (Flow A), venue_listings (Flow B), cancellation, completion cron
- [ ] **Phase 3: Role Dashboards** — Artist counters + invitations, venue today + monthly calendar, admin summary
- [ ] **Phase 4: Public Feed + RSVP** — Magazine-style chronological feed (waitlist CTA when <2 published), free RSVP issuing QR tickets with hard capacity cap
- [ ] **Phase 5: Venue Scan & Check-in** — Camera-based QR scanner with iOS Safari fallback and 5s-polling guest list
- [ ] **Phase 6: Email Notifications** — Resend lifecycle emails (invite/request/ACK/RSVP/24h-reminder) with global opt-out and bounce handling
- [ ] **Phase 7: Admin Backoffice & Cold-start** — Suspend/cancel/audit views, bootstrap-create gated by ENV flag, 8-week flag-still-on cron alert

## Phase Details

### Phase 0: Skeleton & Infra
**Goal**: A production-grade Next.js 16 + Drizzle + Neon + Vercel skeleton is deployed with the full locked stack, the 10-table schema migrated, CI/Sentry/audit infrastructure live, and all day-1 NFRs already enforced — so every subsequent phase ships against a non-negotiable quality bar instead of "we'll add tests/a11y/monitoring later."
**Depends on**: Nothing (first phase)
**Requirements**: REQ-quality-bar, REQ-audit-log
**Success Criteria** (what must be TRUE):
  1. A push to `main` triggers GitHub Actions running typecheck + lint + Vitest + Playwright; the merge is blocked unless all four pass, and a successful merge produces a Vercel preview deployment with a manual gate to production
  2. The 10-table Drizzle schema (users, artist_profiles, venue_profiles, event_proposals, venue_listings, events, event_messages, tickets, audit_log, magic_link_tokens) is migrated to Neon with all DB CHECKs (`events.capacity > 0`, `(events.status='published') = (artistAck AND venueAck)`), UNIQUE constraints (`tickets(eventId,userId)`, `tickets.qrHash`, `magic_link_tokens.tokenHash`), and the 8 day-1 indexes in place
  3. A deliberately-thrown error in any deployed route surfaces in Sentry within seconds and triggers a P1 alert to Telegram/email
  4. An audit-write helper exists, writes to `audit_log` (with `actorUserId=NULL` for system actions), and is unit-tested on Postgres testcontainers
  5. A placeholder landing page at `/` passes Lighthouse Mobile ≥ 90, axe shows zero WCAG 2.1 AA violations, and a GDPR cookie banner is rendered
  6. Vercel Blob, Resend, and Better Auth are wired with secrets in Vercel ENV (separate dev/preview/prod), never in git
**Plans**: 1 plan (1/1 complete)
- [x] 00-01-PLAN.md — Skeleton & Infra (single-file phase plan; 33/35 tasks effective — T-29/T-32 reframed to PL-01..PL-03; SUMMARY in 00-01-SUMMARY.md)

### Phase 1: Auth & Profiles
**Goal**: A real human can request a magic link, click it, land authenticated as an artist or venue, complete their profile (including media uploads to Vercel Blob), and be correctly admitted to or denied from `/artist/*`, `/venue/*`, `/admin/*`, and `/me` based on their role — with replay-safe tokens and bounce handling already in place.
**Depends on**: Phase 0
**Requirements**: REQ-roles-rbac, REQ-magic-link-auth, REQ-profile-uploads
**Success Criteria** (what must be TRUE):
  1. A new user can submit their email at `/login`, receive a magic-link email from Resend, click it, and arrive at `/me` with an established session — and a second click on the same link is rejected with a clear "Link bereits verwendet" message
  2. A magic-link request returns 429 after the 11th attempt within a minute from the same IP
  3. An authenticated `role=artist` user gets 200 on `/artist`, 403 on `/venue`, 403 on `/admin`; same matrix verifies for venue and admin roles; anonymous visitors get 200 on `/`, `/events`, `/events/[slug]`, `/artists/[slug]`, `/venues/[slug]`, `/login`, `/auth/verify`
  4. Exactly one admin exists and was created via ENV-driven provisioning (no signup path produces an admin)
  5. An artist can complete their profile (displayName, bio, optional Instagram/website) and upload portfolio images via signed Vercel Blob URLs that respect a per-user file count limit; uploaded URLs render publicly on `/artists/[slug]`
  6. A venue can complete their profile (name, address, capacity, photos) and uploaded photos render publicly on `/venues/[slug]`
  7. A Resend bounce webhook for a known email flips `users.status='email_invalid'` and subsequent magic-link sends to that address are blocked
**Plans**: TBD
**UI hint**: yes

### Phase 2: Marketplace State Machine
**Goal**: Both bilateral flows (artist-initiated and venue-initiated) work end-to-end — artists can publish proposals, venues can publish listings, either side can invite/request the other, and an event flips to `published` automatically the instant both ACKs are true. Cancellation and 24h auto-completion are handled, including under double-ACK race conditions and admin-suspended users.
**Depends on**: Phase 1
**Requirements**: REQ-bilateral-marketplace-state-machine, REQ-event-proposals, REQ-venue-listings
**Success Criteria** (what must be TRUE):
  1. An artist completes the 2-step wizard at `/artist/proposals/new` (details → dates+capacity+poster) and the new proposal appears in `/venue/proposals` sorted by `createdAt DESC`
  2. A venue completes `/venue/listings/new` (title + availableDates) and the new listing appears in `/artist/venues`
  3. Flow A (venue invites artist on a proposal) and Flow B (artist requests a venue listing) both produce an `events` row in `proposed` state with the correct ACK booleans pre-set; the event flips to `published` and `publishedAt = now()` the moment the second ACK lands, enforced by the DB CHECK `(status='published') = (artistAck AND venueAck)`
  4. A simulated double-ACK race (two concurrent transactions setting the second ACK) leaves exactly one consistent published row, both audit_log entries present, no constraint violation
  5. Either party cancelling a `proposed` or `published` event sets `status='cancelled'`, sets `cancelledAt`/`cancelledReason`, and (if there are any RSVPs from a future phase, hooks are in place to) cancels associated tickets
  6. A scheduled Vercel function flips `published` events to `completed` 24h after `events.startAt`, verified by a unit test that mocks the cron tick
  7. When an admin suspends a user, that user's `proposed` events freeze (no further state transitions accepted) and their `published` events surface to admin for cancel-or-leave decision
**Plans**: TBD

### Phase 3: Role Dashboards
**Goal**: Every signed-in role lands on a dashboard that tells them, in one glance, what they need to do next — artists see their pipeline counters and pending invitations, venues see today's schedule plus a monthly calendar, admin sees a system summary.
**Depends on**: Phase 2
**Requirements**: REQ-dashboards
**Success Criteria** (what must be TRUE):
  1. `/artist` shows four live counters (proposals, drafts, published, completed) computed from the artist's `event_proposals` and `events` rows, plus a list of pending invitations from venues
  2. `/venue` shows the venue's "today" view (events with `startAt` on the current date) plus a dashboard of pipeline counters
  3. `/venue/calendar` renders a monthly calendar with events placed on their `startAt` dates and is keyboard-navigable per WCAG 2.1 AA
  4. `/admin` shows a system summary (counts of users by role, events by status, recent audit_log entries)
  5. All three dashboards pass Lighthouse Mobile ≥ 90 and have zero WCAG 2.1 AA violations
**Plans**: TBD
**UI hint**: yes

### Phase 4: Public Feed + RSVP
**Goal**: Anyone — anonymous or authenticated — can browse a clean magazine-style feed of upcoming events, click into one, RSVP with a single confirmation, and receive a QR ticket they can present at the door. When the platform is "empty" (fewer than 2 published events), the landing flips to a waitlist CTA so it never looks dead.
**Depends on**: Phase 2 (also lifts the cancel-with-RSVPs bulk-email side-effect bound in Phase 2)
**Requirements**: REQ-public-feed, REQ-rsvp-qr-ticketing
**Success Criteria** (what must be TRUE):
  1. `/` shows a hero plus the next 4–6 published events; when published-event count drops below 2, the landing flips to the waitlist CTA "Ihr werdet benachrichtigt, wenn das nächste Event live geht"
  2. `/events` lists every published event chronologically with no genre/search filters and no per-city filter (single Kreis-wide feed)
  3. `/events/[slug]` shows event details and a working RSVP CTA for any authenticated user
  4. RSVPing creates one `tickets` row with a 22-char base64url crypto-random `qrHash`, sets `status='active'`, and is rejected with a 409 if the user has already RSVP'd that event (DB UNIQUE on `(eventId, userId)`)
  5. A simulated stampede where N+1 users RSVP a capacity-N event yields exactly N successful tickets and exactly 1 transactional rejection — verified by an integration test
  6. `/me` displays the user's active tickets with rendered QR codes (via the `qrcode` library) suitable for display on a phone screen
  7. Cancelling an event with existing RSVPs (from Phase 2's cancel path) fires a Resend bulk email to all RSVP'd users and flips their `tickets.status='cancelled'`
**Plans**: TBD
**UI hint**: yes

### Phase 5: Venue Scan & Check-in
**Goal**: At the door, a venue staff member opens their phone, scans guests' QR codes, and sees the guest list update live — replays are caught, fraud is prevented, and iOS Safari camera quirks have a manual-typing fallback so no one is locked out.
**Depends on**: Phase 4
**Requirements**: REQ-qr-checkin-scanner
**Success Criteria** (what must be TRUE):
  1. `/venue/scan` opens the device camera via `@zxing/browser`; on a valid QR scan the matching ticket flips to `status='used'`, `usedAt=now()`, and the UI shows a green confirmation
  2. A second scan of the same QR returns a yellow banner reading "Bereits eingecheckt um HH:MM" and does not change `usedAt`
  3. A scan of an invalid or `cancelled` ticket returns a red banner and does not modify any row
  4. `/api/tickets/redeem` returns 429 after the 51st redeem in a minute from the same venue
  5. `/venue/events/[id]/manage` polls every 5 seconds and displays a guest list whose `used` count changes within 5s of a scan happening on a different device
  6. When the camera fails to open (verified manually on iOS Safari, also covered by a Playwright path that disables camera permission), the UI exposes a manual ticket-code input that performs the same redeem call
  7. `/venue/scan` passes Lighthouse Mobile ≥ 90 and is fully keyboard-operable for the manual-typing path
**Plans**: TBD
**UI hint**: yes

### Phase 6: Email Notifications
**Goal**: Every meaningful lifecycle event triggers a transactional email to the right people via Resend — with a single global opt-out link and bounce-handling already wired so the system never silently keeps sending to dead addresses.
**Depends on**: Phase 4 (RSVPs must exist before RSVP/reminder emails can fire) and Phase 2 (lifecycle hooks)
**Requirements**: REQ-email-notifications
**Success Criteria** (what must be TRUE):
  1. A venue sending an invite to an artist's proposal triggers a templated email to that artist; an artist sending a request to a venue's listing triggers a templated email to that venue
  2. The second-side ACK that flips an event to `published` triggers a "your event is live" email to both parties
  3. Each new RSVP triggers an email to both the event's artist and venue
  4. A scheduled function fires a 24h-before-startAt reminder email to every user with an `active` ticket on that event, exactly once per (user, event)
  5. Every email contains a footer "Abmelden" link that flips a global email opt-out flag on `users`; subsequent lifecycle emails to that user are suppressed
  6. The Resend bounce webhook handler from Phase 1 continues to set `users.status='email_invalid'` and these emails are also suppressed for invalid-status users
**Plans**: TBD

### Phase 7: Admin Backoffice & Cold-start
**Goal**: The single admin (Jakob) can do everything the platform needs to launch and police itself: suspend/activate users, cancel published events with bulk notification, inspect every audit_log entry, and bootstrap-create seed events directly with both ACKs set — gated behind an ENV flag that auto-alerts after 8 weeks if it's still on, so the cold-start scaffolding doesn't quietly become permanent.
**Depends on**: Phase 6 (cancel email blast already exists) and Phases 0–2 (audit + state machine)
**Requirements**: REQ-admin-moderation
**Success Criteria** (what must be TRUE):
  1. `/admin/users` lists all users; the admin can suspend/activate any non-admin user and the action writes an audit_log entry (`user.suspend` or `user.activate`) with `actorUserId` set to the admin
  2. `/admin/events` lists all published events; the admin can cancel any one and the cancel triggers the Phase 4 bulk email path plus tickets cancellation, with a `event.cancel` audit entry
  3. `/admin/events/new` is reachable only when `ENV.ENABLE_BOOTSTRAP=true`; submitting it creates an `events` row with `bootstrapped=true`, both ACKs pre-set to true, status `published`, and writes an `event.bootstrap` audit entry — when the ENV flag is unset the route returns 404
  4. A scheduled function checks `ENABLE_BOOTSTRAP` once per day and, after 8 weeks since first deploy OR after 10 published non-bootstrapped events have ever existed, fires a P1 alert to Telegram/email if the flag is still on
  5. `/admin/audit` lists every audit_log entry paginated by `createdAt DESC`, filterable by `target`
**Plans**: TBD
**UI hint**: yes

## Pre-Launch Tasks

Tasks that are intentionally deferred until immediately before the v1 public launch — typically driven by the custom-domain cut-over and final production-grade hardening. These are NOT a separate phase in the execution order; they are a checklist to clear during launch week.

**Trigger:** when the custom production domain is provisioned (target Recklinghausen-area `.de` domain TBD).

| ID | Task | Source | Notes |
|----|------|--------|-------|
| PL-01 | Toggle Vercel "Stage and manually promote production deployments" | DEC-020 + REQ-quality-bar (manual-prod-promote gate) | Deferred from Phase 0 (T-29) on 2026-04-29 — bound to the moment a custom domain exists; meaningless while production = `*.vercel.app` preview |
| PL-02 | Generate `VERCEL_AUTOMATION_BYPASS_SECRET` and push to ENV | Required by Playwright e2e to access protected previews | Pairs with PL-01 |
| PL-03 | First manual production promote + smoke verify | DEC-020 enforcement proof | Deferred from Phase 0 (T-32) on 2026-04-29 — reachable only once PL-01 is on |
| PL-04 | Verify Sentry P1 → Telegram round-trip on a production-domain deployment (not preview) | REQ-quality-bar SC#3 final proof | The Phase 0 verify on `*.vercel.app` is sufficient for Phase 0 SC; this re-verifies on the custom domain |
| PL-05 | Lighthouse Mobile ≥ 0.9 against the custom-domain URL | REQ-quality-bar (Lighthouse target) | Phase 0 verifies against `*.vercel.app`; this re-checks final domain (CDN, font-loader, custom-domain SSL all interact with perf) |

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Skeleton & Infra | 0/1 | Planned | - |
| 1. Auth & Profiles | 0/TBD | Not started | - |
| 2. Marketplace State Machine | 0/TBD | Not started | - |
| 3. Role Dashboards | 0/TBD | Not started | - |
| 4. Public Feed + RSVP | 0/TBD | Not started | - |
| 5. Venue Scan & Check-in | 0/TBD | Not started | - |
| 6. Email Notifications | 0/TBD | Not started | - |
| 7. Admin Backoffice & Cold-start | 0/TBD | Not started | - |

## Coverage Audit

- **v1 requirements:** 14
- **Mapped to phases:** 14 (every REQ-* assigned to exactly one phase — see REQUIREMENTS.md `## Traceability`)
- **Unmapped:** 0
- **Duplicates:** 0
- **Out-of-scope guard:** REQ-out-of-scope-v1 (16 exclusions) recorded in REQUIREMENTS.md `## Out of Scope` and PROJECT.md
- **Constraints reflected:** all 7 CON-* (CON-data-model in Phase 0; CON-tech-stack in Phase 0; CON-routes distributed across owning phases; CON-state-machine in Phase 2; CON-quality-nfrs in Phase 0; CON-edge-cases distributed; CON-cold-start-operational split between Phase 4 (waitlist CTA) and Phase 7 (bootstrap flag + cron))
- **Decisions reflected:** all 22 DEC-* recorded as `locked` in PROJECT.md `## Key Decisions`

---
*Roadmap created: 2026-04-28 from .planning/intel/ synthesis (single SPEC: docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md, status APPROVED)*
