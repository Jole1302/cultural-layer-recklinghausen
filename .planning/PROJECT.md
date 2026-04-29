# Cultural Layer Recklinghausen

## What This Is

A bilateral event marketplace for the Kreis Recklinghausen / Ruhrgebiet region (Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel and neighbours). Semi-pro artists and small non-traditional venues (lofts, studios, Zechen, galleries) match each other through a mutual-acknowledgement lifecycle; published events surface in a chronological public feed, visitors RSVP free and check in via QR at the door. The product framing is **supply-creation** for an under-aggregated regional scene — the opposite of Berlin-style de-aggregation.

## Core Value

When an artist and a venue both confirm an event, it ships to a clean local feed and visitors actually show up — verified at the door by QR. **Without bilateral confirmation + check-in proof, nothing else matters.**

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — pre-implementation)

### Active

<!-- Current scope. Building toward these. v1 = 14 requirements, see REQUIREMENTS.md for full list. -->

- [ ] **REQ-roles-rbac** — Four roles (public, artist, venue, admin) with role-gated routes
- [ ] **REQ-magic-link-auth** — Email + magic link via Resend, 15min TTL, single-use
- [ ] **REQ-bilateral-marketplace-state-machine** — proposed → published (mutual ACK) → completed/cancelled
- [ ] **REQ-event-proposals** — Artists publish event proposals (2-step wizard)
- [ ] **REQ-venue-listings** — Venues publish availability listings
- [ ] **REQ-rsvp-qr-ticketing** — Free RSVP issues a QR ticket; one ticket per user per event
- [ ] **REQ-qr-checkin-scanner** — Venue camera scan + 5s-polling guest list
- [ ] **REQ-public-feed** — Single Kreis-wide chronological feed; waitlist CTA when <2 published
- [ ] **REQ-dashboards** — Role-specific dashboards (artist counters, venue today+calendar, admin summary)
- [ ] **REQ-email-notifications** — Lifecycle email at invite/request/ACK/RSVP/24h-reminder
- [ ] **REQ-profile-uploads** — Vercel Blob signed-upload for portfolio/photos/posters
- [ ] **REQ-admin-moderation** — Suspend/activate, cancel events, bootstrap-create, audit view
- [ ] **REQ-audit-log** — Every state-change and admin action written to audit_log
- [ ] **REQ-quality-bar** — Day-1 NFRs: 80% critical-path coverage, Lighthouse ≥90, WCAG 2.1 AA, Sentry, p95 <2s, rate-limits, CI gates

### Out of Scope

<!-- Explicit boundaries with reasoning. From REQ-out-of-scope-v1. -->

- **Stripe / paid tickets / commissions** — v1 is free; no payments overhead until cold-start is solved
- **Push notifications (web-push API)** — overkill for v1 traffic; email covers lifecycle
- **Offline-PWA scenarios** — install-shell only; offline-first is post-v1
- **Genre / search filters** — ~5 events/month makes filters over-engineering and harms density perception
- **Artist↔venue chat** — minimal `event_messages` table only; no chat UX
- **Reviews / ratings** — premature for cold-start phase
- **Recurring event series** — not in v1 lifecycle
- **Multi-tenant city profiles (Berlin)** — Berlin deferred until PMF in Ruhr
- **SSE / websockets** — polling + SWR is sufficient for v1 volumes
- **Phone-based auth** — magic link only
- **OAuth (Google / Apple)** — magic link only
- **Multiple admins** — single ENV-provisioned admin; multi-admin is post-v1
- **Subdomain per city** — single Kreis-wide feed, no per-city split
- **Artist pre-approval gate** — post-hoc admin moderation only (low barrier for cold-start)
- **Capacity overbook / waitlist** — hard cap at RSVP time
- **DE+EN i18n** — DE only (audience is local Ruhr Lokalpatrioten)

## Context

**Strategic framing:** The region has an event **deficit**, not over-supply. Artists cannot draw an audience even for free; venues do not know they are needed. Berlin-style de-aggregation (the assumption baked into the Berlin PRD v3.0 in `.planning/imports/`) does not work here. The Berlin PRD is **context-only reference material** — the SPEC at `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` is the authoritative scope source. The single explicit carry-over from Berlin PRD is the GDPR cookie banner NFR.

**Cold-start is the primary risk.** Operational practice (offline curator onboarding, anchor partnership with a Zeche or culture centre, seed posts in Instagram `ruhr_art` and local WhatsApp groups) is documented in the SPEC §9 but lives partly outside the codebase. In-code enforcement: landing flips to waitlist CTA when <2 PUBLISHED events exist; `/admin/events/new` bootstrap-create gated by `ENABLE_BOOTSTRAP=true`; cron alerts after 8 weeks if the flag is still on.

**Personas:** Public (Ruhr resident 25–40, Lokalpatriot, not Berlin hipster); Artist (semi-pro 22–45, musician/reader/performer/visual); Venue Owner (30–55, often curator of a former industrial site); Admin (single ENV-provisioned account, backoffice tool only).

**Greenfield repo.** Net-new at `/home/jakob/projects/saas/`. No legacy code to evolve. Development started 2026-04-28 from a brainstorming session (id `935f8c9b`). Effort estimate ~150–200h v1.

**Open questions surfaced by the SPEC §14** (to revisit at implementation time, not blockers):
1. Notification preferences UX — v1 = global opt-out only via footer link
2. Event poster aspect ratio — recommended 4:5 for magazine look
3. Venue address geocoding — manual lat/lon entry in v1
4. GDPR cookie banner — required from day 1 (Berlin carry-over)
5. Sitemap/SEO — basic auto-generated `sitemap.xml` from PUBLISHED events

## Constraints

- **Tech stack** (CON-tech-stack, locked): Next.js 16 App Router + React 19, Postgres on Neon (via Vercel Marketplace), Drizzle + drizzle-kit, Better Auth (magic link), Resend, Vercel Blob, Zod (shared FE↔API), Tailwind 4 + shadcn/ui base + magazine-CSS overlay, `qrcode` + `@zxing/browser`, polling + SWR 5–10s, Vitest + Playwright + Postgres testcontainers, Sentry, GitHub Actions → Vercel, Vercel Functions (Fluid Compute, Node.js 24, default 300s timeout). **Rejected:** Firebase, Cloudinary, Stripe (v1), web-push, microservices, Edge runtime, Turbo monorepo
- **Data model** (CON-data-model): 10 tables — `users`, `artist_profiles`, `venue_profiles`, `event_proposals`, `venue_listings`, `events`, `event_messages`, `tickets`, `audit_log`, `magic_link_tokens`. Day-1 indexes on `events(status,startAt)`, `events(artistId,status)`, `events(venueId,status)`, `event_proposals(status,createdAt DESC)`, `venue_listings(status,createdAt DESC)`, `tickets(eventId,status)`, `tickets(userId,status)`, `audit_log(target,createdAt DESC)`. DB invariants: `events.capacity > 0`, `(events.status='published') = (artistAck AND venueAck)`, `tickets UNIQUE(eventId,userId)`, `tickets.qrHash UNIQUE`, `magic_link_tokens.tokenHash UNIQUE` (HMAC at rest)
- **Routes** (CON-routes): ~25 routes across public/artist/venue/admin surfaces — full inventory in REQUIREMENTS.md and intel/constraints.md
- **State machine** (CON-state-machine): `proposed → published` (auto when both ACK) → `completed` (cron 24h post-startAt). `cancelled` reachable from `proposed` or `published`. Concurrent double-ACK uses `SELECT FOR UPDATE`; both audit entries written; last-write-wins
- **Quality NFRs** (CON-quality-nfrs, day-1 binding): 80% test coverage on critical paths (auth, ticket gen/redeem, QR validate, state transitions, RSVP), Lighthouse Mobile ≥90 on `/`, `/events`, `/events/[slug]`, `/venue/scan`, WCAG 2.1 AA (contrast ≥4.5:1, focus 2px, ARIA labels, keyboard nav), Sentry from first deploy with P1 alerts, p95 page load <2s, rate limits (`/api/auth/magic-link` = 10/min/IP, `/api/tickets/redeem` = 50/min/venue), audit_log on every state-change + admin action, CI gate (typecheck + lint + Vitest + Playwright must pass for `main` merge), Vercel ENV secrets only (separate dev/preview/prod)
- **Edge cases** (CON-edge-cases, mandated): double-ACK race (`SELECT FOR UPDATE`, last-write-wins), capacity overflow (transactional COUNT), QR replay (UNIQUE qrHash + status check, yellow "Bereits eingecheckt um HH:MM"), event-cancelled-with-RSVPs (bulk email + tickets cancelled), magic link replay (single-use + 15min TTL + post-use invalidation), email bounce (Resend webhook → `users.status='email_invalid'`), iOS Safari camera fallback (manual ticket-code typing), artist account deleted (events preserved, profile CASCADE, UI shows "Artist removed"), spam signup (rate limit + email confirmation before proposal creation)
- **Cold-start** (CON-cold-start-operational, in-code parts): landing → waitlist CTA when <2 PUBLISHED, `/admin/events/new` gated by `ENABLE_BOOTSTRAP=true` ENV flag, cron checks flag after 8 weeks (or 10 published events) and alerts
- **Scope guard** (CON-spec-context-pointer): Berlin PRD is context-only; spec wins where they differ; only GDPR cookie banner is a Berlin → v1 carry-over

## Key Decisions

<!-- 22 locked decisions from intel/decisions.md, status: locked. Promoted from SPEC §13 + §7. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **DEC-001** Target market v1: Recklinghausen / Kreis Recklinghausen, not Berlin | Cold-start is the primary obstacle in Ruhr (event deficit, not over-aggregation). Berlin product does not fit this market. | locked |
| **DEC-002** Codebase strategy: greenfield in `/projects/saas/` | Clean stack; Berlin PRD ≠ legacy code to evolve. | locked |
| **DEC-003** Wedge: bilateral marketplace + check-in (Variant B), no Stripe/push in v1 | Full lifecycle is needed but commerce/notification overhead is deferred. | locked |
| **DEC-004** Geo filter: single Kreis-wide feed, no per-city filter, no subdomain per city | ~5 events/month — filters are over-engineering and harm density perception. | locked |
| **DEC-005** Artist verification: post-hoc admin moderation (no pre-approval gate) | Low barrier to entry needed for cold-start. | locked |
| **DEC-006** UI language: German only in v1 (no DE+EN i18n) | Audience is local Ruhr Lokalpatrioten. | locked |
| **DEC-007** Capacity policy: hard cap via transactional COUNT (no waitlist v1) | Simplicity; waitlist is parking lot. | locked |
| **DEC-008** Auth: Better Auth email + magic link, 15min TTL, single-use, post-use invalidation. No phone, no OAuth. | Lightweight, no Firebase lock-in, full control. | locked |
| **DEC-009** DB: Postgres on Neon (Vercel Marketplace), not Firestore | Serverless Postgres with branch-per-PR previews; rejects Firestore. | locked |
| **DEC-010** ORM: Drizzle + drizzle-kit, not Prisma; migrations versioned in git | Type-safe, lighter than Prisma. | locked |
| **DEC-011** File storage: Vercel Blob (public-read + signed upload URL flow), not Cloudinary | Native to Vercel, cheaper than Cloudinary. | locked |
| **DEC-012** Real-time: polling with SWR every 5–10s. No SSE, no websockets in v1. | SSE/websockets are overengineering for v1 traffic volumes. | locked |
| **DEC-013** Framework: Next.js 16 App Router + React 19 (Server Components + Cache Components) | Locked tech stack §7. | locked |
| **DEC-014** Email: Resend (bulk + magic link delivery; bounce webhook → `users.status='email_invalid'`) | Locked tech stack §7. | locked |
| **DEC-015** Validation: Zod schemas shared frontend ↔ API | Locked tech stack §7. | locked |
| **DEC-016** UI: Tailwind 4 + shadcn/ui base, magazine-CSS overlay; a11y-first markup | Locked tech stack §7; magazine is a CSS layer on top. | locked |
| **DEC-017** QR: `qrcode` (gen) + `@zxing/browser` (in-browser camera scan) | Locked tech stack §7. | locked |
| **DEC-018** Tests: Vitest (unit) + Playwright (e2e) + Postgres testcontainers (integration); pyramid from day 1 | Locked tech stack §7 + §10. | locked |
| **DEC-019** Errors: Sentry from day 1; P1 alerts to Telegram/email | Locked tech stack §7 + §10. | locked |
| **DEC-020** CI/CD: GitHub Actions → Vercel; preview per PR; manual gate to production | Locked tech stack §7 + §10. **Manual-gate-to-production scope (2026-04-29 reframe):** binding *only when a custom production domain exists*. Until then (Phase 0..pre-launch), `*.vercel.app` preview = production; auto-deploy on push to `main` is acceptable. The manual-promote toggle activates as a Pre-Launch task when the custom domain is provisioned. | locked |
| **DEC-021** Hosting: Vercel Functions (Fluid Compute, Node.js 24, default 300s timeout). Edge runtime explicitly NOT used. | Locked tech stack §7. | locked |
| **DEC-022** Explicitly rejected technologies: Firebase, Cloudinary, Stripe (v1), web-push, microservices, Edge runtime, Turbo monorepo | Tightens stack contract; bars these from re-emerging. | locked |

---
*Last updated: 2026-04-28 after ingest synthesis (22 DEC + 14 REQ + 7 CON sources: docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md, .planning/intel/)*
