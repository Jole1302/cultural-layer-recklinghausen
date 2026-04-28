# Constraints (synthesized from classified docs)

Technical contracts, schemas, and NFRs extracted from SPEC-type material. Constraints are binding for v1 implementation.

Single source: `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` (SPEC, status APPROVED).

---

## CON-data-model — Drizzle data model (10 entities)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§6)
- **type:** schema
- **content:**

Entities (final SQL via drizzle-kit migrations; types below are the schema sketch):

```
users {
  id: uuid PK
  email: text UNIQUE NOT NULL
  role: enum('public', 'artist', 'venue', 'admin') NOT NULL
  status: enum('active', 'suspended', 'email_invalid') NOT NULL DEFAULT 'active'
  createdAt: timestamptz NOT NULL DEFAULT now()
}

artist_profiles {
  userId: uuid PK FK→users.id ON DELETE CASCADE
  displayName: text NOT NULL
  bio: text
  instagramUrl: text
  websiteUrl: text
  portfolioBlobs: jsonb  // [{url, alt, order}]
}

venue_profiles {
  userId: uuid PK FK→users.id ON DELETE CASCADE
  name: text NOT NULL
  addressStreet: text
  addressCity: text          // Recklinghausen, Marl, ...
  addressPostal: text
  geoLat: numeric, geoLon: numeric
  capacity: int NOT NULL
  photoBlobs: jsonb          // [{url, alt}]
  description: text
}

event_proposals {
  id: uuid PK
  artistId: uuid FK→users.id NOT NULL
  title: text NOT NULL
  description: text
  preferredDates: date[]
  capacityWanted: int
  posterBlob: text          // single Blob URL
  status: enum('open','withdrawn','closed') NOT NULL DEFAULT 'open'
  createdAt: timestamptz, updatedAt: timestamptz
}

venue_listings {
  id: uuid PK
  venueId: uuid FK→users.id NOT NULL
  title: text NOT NULL
  description: text
  availableDates: date[]
  status: enum('open','withdrawn','closed') NOT NULL DEFAULT 'open'
  createdAt, updatedAt
}

events {
  id: uuid PK
  artistId: uuid FK→users.id NOT NULL
  venueId: uuid FK→users.id NOT NULL
  sourceProposalId: uuid? FK→event_proposals.id
  sourceListingId: uuid? FK→venue_listings.id
  title: text NOT NULL
  description: text
  startAt: timestamptz NOT NULL
  capacity: int NOT NULL CHECK (capacity > 0)
  posterBlob: text
  status: enum('proposed','published','cancelled','completed') NOT NULL DEFAULT 'proposed'
  artistAck: bool NOT NULL DEFAULT false
  venueAck: bool NOT NULL DEFAULT false
  publishedAt: timestamptz?
  cancelledAt: timestamptz?, cancelledReason: text?
  bootstrapped: bool NOT NULL DEFAULT false
  createdAt, updatedAt

  CHECK ((status='published') = (artistAck AND venueAck))
}

event_messages {
  id: uuid PK
  eventId: uuid FK→events.id ON DELETE CASCADE
  senderUserId: uuid FK→users.id
  body: text NOT NULL
  createdAt: timestamptz
}

tickets {
  id: uuid PK
  eventId: uuid FK→events.id ON DELETE RESTRICT
  userId: uuid FK→users.id ON DELETE RESTRICT
  qrHash: text UNIQUE NOT NULL  // crypto-random, ~22 chars base64url
  status: enum('active','used','cancelled') NOT NULL DEFAULT 'active'
  issuedAt: timestamptz NOT NULL DEFAULT now()
  usedAt: timestamptz?

  UNIQUE (eventId, userId)
}

audit_log {
  id: uuid PK
  actorUserId: uuid? FK→users.id  // null = system
  action: text NOT NULL
  target: text NOT NULL
  meta: jsonb
  createdAt: timestamptz NOT NULL DEFAULT now()
}

magic_link_tokens {
  id: uuid PK
  email: text NOT NULL
  tokenHash: text UNIQUE NOT NULL  // HMAC, not plaintext
  expiresAt: timestamptz NOT NULL  // now() + 15min
  consumedAt: timestamptz?
}
```

### Day-1 indexes (binding)

- `events`: `(status, startAt)` — public feed
- `events`: `(artistId, status)`, `(venueId, status)` — dashboards
- `event_proposals`: `(status, createdAt DESC)` — venue catalog
- `venue_listings`: `(status, createdAt DESC)` — artist catalog
- `tickets`: `(eventId, status)`, `(userId, status)`
- `audit_log`: `(target, createdAt DESC)`

### Cross-cutting DB invariants

- `events.capacity > 0` (CHECK)
- `events`: `(status='published') = (artistAck AND venueAck)` (CHECK)
- `tickets`: `UNIQUE(eventId, userId)` — one RSVP per user per event
- `tickets`: `qrHash` UNIQUE — replay-safe
- `magic_link_tokens.tokenHash` UNIQUE, hashed (HMAC) at rest

---

## CON-tech-stack — Locked technology stack

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7 — header reads "(locked)")
- **type:** stack contract
- **content:** see `decisions.md` DEC-008..DEC-022 for individual decisions. Summary table:

| Layer | Tool |
|---|---|
| Framework | Next.js 16 App Router + React 19 |
| DB | Postgres → Vercel Marketplace → Neon |
| ORM | Drizzle + drizzle-kit |
| Auth | Better Auth (email + magic link) |
| Email | Resend |
| Files | Vercel Blob (public read, signed upload URL) |
| Validation | Zod (shared FE↔API) |
| UI | Tailwind 4 + shadcn/ui base, magazine-CSS overlay |
| QR | `qrcode` (gen) + `@zxing/browser` (scan) |
| Real-time | Polling + SWR 5–10s |
| Tests | Vitest + Playwright + Postgres testcontainers |
| Errors | Sentry from day 1 |
| CI/CD | GitHub Actions → Vercel (preview per PR, manual prod gate) |
| Hosting | Vercel Functions (Fluid Compute, Node.js 24, default 300s timeout) |

**Rejected (do NOT introduce):** Firebase, Cloudinary, Stripe (v1), web-push, microservices, Edge runtime, Turbo monorepo.

---

## CON-routes — ~25 route surface (route contract)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§8)
- **type:** api-contract (route surface)
- **content:**

Public (anonymous + role=public):
- `/` — landing (hero + 4–6 events; waitlist CTA when <2 published)
- `/events` — full chronological feed (no filters)
- `/events/[slug]` — details + RSVP CTA
- `/artists/[slug]` — artist profile (bio, portfolio, past events)
- `/venues/[slug]` — venue profile (photos, past events)
- `/login` — email magic link request
- `/auth/verify?token=...` — magic link landing → session
- `/me` — own RSVPs + QR tickets

Artist (auth + role=artist):
- `/artist` — dashboard (4 counters + invitations)
- `/artist/proposals` — list of own proposals
- `/artist/proposals/new` — 2-step wizard (details → dates+capacity+poster)
- `/artist/proposals/[id]` — details + invitations
- `/artist/venues` — catalog of venue_listings → request
- `/artist/events` — drafts/published/completed
- `/artist/profile` — edit bio + portfolio

Venue (auth + role=venue):
- `/venue` — dashboard + today
- `/venue/listings` — own listings
- `/venue/listings/new` — create listing
- `/venue/proposals` — catalog of event_proposals → invite
- `/venue/events` — drafts/published/completed
- `/venue/calendar` — monthly calendar
- `/venue/scan` — QR scanner with camera
- `/venue/events/[id]/manage` — real-time guest list (polling 5s)
- `/venue/profile` — photos + capacity + amenities

Admin (role=admin):
- `/admin` — summary
- `/admin/users` — suspend/activate
- `/admin/events` — cancel published events
- `/admin/events/new` — bootstrap-create event (ENV-flag gated)
- `/admin/audit` — audit log

---

## CON-state-machine — Event lifecycle state machine

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§3)
- **type:** protocol (lifecycle)
- **content:**

States: `proposed` → `published` (auto when both ACK) → `completed` (auto 24h after `startAt` via cron). `cancelled` reachable from `proposed` or `published`. `suspended` is a user-state effect, not an event state — when admin suspends a user, their `proposed` events freeze and `published` events surface for admin review.

Transitions:

- `proposed → published`: automatic when `artistAck=true AND venueAck=true`. Sets `publishedAt = now()`.
- `proposed → cancelled` or `published → cancelled`: any party may cancel. Bulk email to RSVP'ed guests; `tickets.status='cancelled'`.
- `published → completed`: cron / Vercel scheduled function, 24h after `events.startAt`.

Invariant (DB CHECK): `(status='published') = (artistAck AND venueAck)`.

Concurrency: double-ACK race uses `SELECT FOR UPDATE` on the events row; both audit_log entries are written; last-write-wins.

Bootstrap path: admin sets both ACKs and `bootstrapped=true` directly via `/admin/events/new`, gated by `ENABLE_BOOTSTRAP=true` ENV flag.

---

## CON-quality-nfrs — Day-1 NFRs (binding)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§10, also §4 Quality row)
- **type:** nfr
- **content:**

- **Test coverage:** 80% on critical paths (auth, ticket gen/redeem, QR validate, state transitions, RSVP flow)
- **Lighthouse Mobile:** ≥ 90 on `/`, `/events`, `/events/[slug]`, `/venue/scan`
- **Accessibility:** WCAG 2.1 AA from day 1 — contrast ≥ 4.5:1, focus indicators 2px, ARIA labels, full keyboard navigation. Magazine aesthetic layered on top of an a11y-first markup base
- **Error monitoring:** Sentry from first deploy; P1 alerts to Telegram/email
- **Page load:** p95 < 2s achieved via Cache Components + edge caching
- **Rate limiting:** `/api/auth/magic-link` = 10/min/IP; `/api/tickets/redeem` = 50/min/venue
- **Audit log:** every state-change and every admin action
- **CI gate:** typecheck + lint + Vitest unit + Playwright e2e — all green required to merge `main`
- **Secrets management:** Vercel ENV only, never in git, separate dev / preview / prod environments

---

## CON-edge-cases — Mandated edge-case behaviours

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§11)
- **type:** protocol (error handling)
- **content:**

| Scenario | Required behaviour |
|---|---|
| Double ACK race | `SELECT FOR UPDATE` on events row; last-write-wins; both audit_log entries written |
| Capacity overflow | INSERT INTO tickets inside transaction with COUNT; reject when COUNT ≥ capacity |
| QR replay attack | `tickets.qrHash UNIQUE` + `status='used'` check; replay returns yellow "Bereits eingecheckt um HH:MM" |
| Event cancelled with RSVPs | Bulk email to all RSVP'd users + `tickets.status='cancelled'` |
| Magic link replay | Single-use token, 15min TTL, post-use invalidation via `consumedAt` |
| Email bounce | Resend webhook → `users.status='email_invalid'` → block further sends |
| iOS Safari camera quirks | Fallback: manual ticket-code typing on `/venue/scan` |
| Artist account deleted | `events` rows preserved (FK is NOT cascade for events.artistId); `artist_profiles` deleted via CASCADE; UI shows "Artist removed" |
| Spam via email signup | Rate limit on signup + email confirmation required before proposal creation |

---

## CON-cold-start-operational — Cold-start / launch policy (operational gate)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§9)
- **type:** protocol (launch policy — operational, partly enforced in code)
- **content:**

In-code enforcement (binding):

- Landing page (`/`) flips to waitlist CTA when fewer than 2 PUBLISHED events exist
- `/admin/events/new` (bootstrap path) is gated by `ENV.ENABLE_BOOTSTRAP=true`
- Cron job verifies `ENABLE_BOOTSTRAP` after 8 weeks (or after 10 PUBLISHED events) and alerts if still enabled

Operational policy (out-of-code, recorded for context):

- No public launch with 0 events; minimum 2 PUBLISHED events at launch
- Curator (Jakob) onboards first 2–3 venues + 5 artists offline (call/visit) and uses admin-create flow
- Anchor partnership: 1 Zeche or culture centre provides venue free in exchange for "we bring artist + audience"
- Seed posts in Instagram (`ruhr_art`) + WhatsApp groups; flyers with QR → `/events`
- Alive metric: ≥ 1 RSVP'd event/week — else pause growth

---

## CON-spec-context-pointer — Spec references Berlin PRD as context only

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (header line: "Reference: Berlin PRD v3.0 (`.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md`) — context only, NOT scope source.")
- **type:** scope guard
- **content:** The Berlin PRD v3.0 in `.planning/imports/` is reference material for context and inspiration only. It MUST NOT be treated as authoritative requirements for v1. Where the spec and the Berlin PRD differ, the spec wins by definition (the spec was authored explicitly to override Berlin assumptions for the Recklinghausen market). Note: GDPR cookie banner is the one explicit NFR carry-over from Berlin PRD (per §14 open question 4).
