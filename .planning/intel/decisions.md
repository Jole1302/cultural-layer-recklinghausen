# Decisions (synthesized from classified docs)

Decisions extracted from ingested planning documents. Locked decisions cannot be auto-overridden by lower-precedence sources.

Per orchestrator instruction: section 13 of the SPEC at `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` ("Decisions log — зафиксировано в brainstorming") is treated as an embedded ADR-style decisions log and surfaced here as **locked** decisions even though the parent doc type is SPEC. The spec itself is marked `Status: APPROVED — ready for implementation plan`, which corresponds to ADR Accepted semantics for the embedded decisions.

---

## DEC-001 — Target market v1: Recklinghausen / Kreis Recklinghausen (Ruhr), not Berlin

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §1)
- **status:** locked (embedded ADR, parent spec APPROVED)
- **scope:** geographic launch market for v1
- **decision:** Launch v1 in Kreis Recklinghausen / Ruhrgebiet (Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel and neighbours). Berlin is deferred until product-market fit in Ruhr.
- **rationale:** Cold-start is the primary obstacle in Ruhr (event deficit, not over-aggregation). Berlin-style de-aggregation product does not fit. Different product needed.

---

## DEC-002 — Codebase strategy: greenfield in /projects/saas/

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13)
- **status:** locked
- **scope:** repository / codebase origin
- **decision:** Build greenfield in `/projects/saas/`. The Berlin PRD v3.0 is reference material only, not legacy code to evolve.
- **rationale:** Clean stack; PRD ≠ legacy.

---

## DEC-003 — Wedge: bilateral marketplace + check-in (Variant B)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §3, §4)
- **status:** locked
- **scope:** product wedge / v1 feature scope
- **decision:** Full lifecycle bilateral marketplace + QR check-in. No Stripe, no push notifications in v1.
- **rationale:** Full lifecycle is needed but commerce/notification overhead is deferred.

---

## DEC-004 — Geo filter: Kreis-wide single feed (no per-city filter)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §5)
- **status:** locked
- **scope:** discovery / public feed UX
- **decision:** Single Kreis-wide feed; no per-city filter, no subdomain per city.
- **rationale:** ~5 events/month volume — filters are over-engineering and harm density perception.

---

## DEC-005 — Artist verification: post-hoc admin moderation (no pre-approval gate)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §5)
- **status:** locked
- **scope:** trust & safety / onboarding gate
- **decision:** Artists self-onboard; admin moderates after the fact (suspend/cancel). No pre-approval gate before posting proposals.
- **rationale:** Low barrier to entry needed for cold-start.

---

## DEC-006 — UI language: German only in v1

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §5)
- **status:** locked
- **scope:** internationalisation
- **decision:** v1 ships DE only. No DE+EN i18n.
- **rationale:** Audience is local Ruhr Lokalpatrioten.

---

## DEC-007 — Capacity policy: hard cap (no waitlist v1)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §5, §11)
- **status:** locked
- **scope:** RSVP / ticketing capacity behaviour
- **decision:** Hard capacity cap enforced at RSVP time via transactional COUNT check. No waitlist, no overbook.
- **rationale:** Simplicity; waitlist is parking lot.

---

## DEC-008 — Auth: email + magic link (no phone, no OAuth)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §4, §7)
- **status:** locked
- **scope:** authentication mechanism
- **decision:** Better Auth with email magic link, 15min TTL, single-use token, post-use invalidation. No phone-based auth, no Google/Apple OAuth in v1.
- **rationale:** Lightweight, no Firebase lock-in, full control.

---

## DEC-009 — DB: Postgres on Neon (Vercel Marketplace), not Firestore

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §7)
- **status:** locked
- **scope:** primary datastore
- **decision:** Postgres via Vercel Marketplace → Neon. Branchable preview deployments.
- **rationale:** Serverless Postgres with branch-per-PR previews; rejects Firestore.

---

## DEC-010 — ORM: Drizzle, not Prisma

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §7)
- **status:** locked
- **scope:** ORM / migrations tooling
- **decision:** Drizzle + drizzle-kit; migrations versioned in git.
- **rationale:** Type-safe, lighter than Prisma.

---

## DEC-011 — File storage: Vercel Blob, not Cloudinary

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §7)
- **status:** locked
- **scope:** binary file storage (posters, portfolio, venue photos)
- **decision:** Vercel Blob with public-read URLs and signed upload URL flow.
- **rationale:** Native to Vercel, cheaper than Cloudinary.

---

## DEC-012 — Real-time: polling (SWR 5–10s), not SSE/websockets

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§13, also §7, also §4 check-in row)
- **status:** locked
- **scope:** real-time update mechanism (guest list, notifications)
- **decision:** Polling with SWR every 5–10s. No SSE, no websockets in v1.
- **rationale:** SSE/websockets are overengineering for v1 traffic volumes.

---

## Cross-cutting framework decisions (extracted from §7 tech stack — locked because §7 is labeled "(locked)")

These complement DEC-008..DEC-012 with the rest of the locked stack.

### DEC-013 — Framework: Next.js 16 App Router + React 19

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7)
- **status:** locked (per "Tech stack (locked)" header)
- **scope:** application framework
- **decision:** Next.js 16 with App Router and React 19, leveraging Server Components and Cache Components.

### DEC-014 — Email: Resend

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7)
- **status:** locked
- **scope:** transactional email provider
- **decision:** Resend for bulk templates and magic-link delivery; webhook for bounce → `users.status='email_invalid'`.

### DEC-015 — Validation: Zod (shared frontend ↔ API)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7)
- **status:** locked
- **scope:** input validation
- **decision:** Zod schemas shared across frontend and API.

### DEC-016 — UI: Tailwind 4 + shadcn/ui base, magazine-CSS overlay

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7, also §10 a11y note)
- **status:** locked
- **scope:** UI foundation
- **decision:** Tailwind 4 + shadcn/ui as base, magazine-CSS layer on top. A11y-first; magazine aesthetic is a layer.

### DEC-017 — QR: `qrcode` (gen) + `@zxing/browser` (scan)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7)
- **status:** locked
- **scope:** QR code generation and scanning libraries
- **decision:** `qrcode` for generation; `@zxing/browser` for in-browser camera scan.

### DEC-018 — Tests: Vitest + Playwright + Postgres testcontainers

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7, also §10)
- **status:** locked
- **scope:** testing toolchain
- **decision:** Vitest (unit), Playwright (e2e), Postgres testcontainers (integration). Pyramid from day 1.

### DEC-019 — Errors: Sentry from day 1

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7, also §10)
- **status:** locked
- **scope:** error monitoring
- **decision:** Sentry wired from first deploy; P1 alerts to Telegram/email.

### DEC-020 — CI/CD: GitHub Actions → Vercel, manual prod gate

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7, also §10)
- **status:** locked
- **scope:** continuous integration and deployment
- **decision:** GitHub Actions → Vercel, preview per PR, manual gate to production.

### DEC-021 — Hosting: Vercel Functions (Fluid Compute, Node.js 24, 300s timeout default)

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7)
- **status:** locked
- **scope:** runtime / hosting
- **decision:** Vercel Functions on Fluid Compute, Node.js 24 runtime, default 300s timeout. Edge runtime explicitly NOT used.

### DEC-022 — Explicitly rejected technologies

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§7 "Не используем" line, §13)
- **status:** locked
- **scope:** technology exclusions
- **decision:** Do NOT use: Firebase, Cloudinary, Stripe (in v1), web-push, microservices, Edge runtime, Turbo monorepo.
