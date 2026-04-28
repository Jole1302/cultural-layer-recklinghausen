# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** When an artist and a venue both confirm an event, it ships to a clean local feed and visitors actually show up — verified at the door by QR.
**Current focus:** Phase 0 — Skeleton & Infra

## Current Position

Phase: 0 of 7 (Skeleton & Infra)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-28 — Bootstrap from intel synthesis (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md created)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: (none)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md `## Key Decisions` (22 locked decisions DEC-001..DEC-022).
Recent decisions affecting current work:

- DEC-002: Greenfield in `/projects/saas/` — no legacy migration; Phase 0 starts from empty repo
- DEC-021: Vercel Functions on Fluid Compute (Node.js 24, 300s timeout); Edge runtime explicitly NOT used — Phase 0 sets this in `vercel.json`
- DEC-009 + DEC-010: Postgres via Neon + Drizzle migrations versioned in git — Phase 0 wires `vercel link` + Vercel Marketplace integration for Neon
- DEC-019: Sentry from day 1 with P1 alerts to Telegram/email — Phase 0 wires before any feature route exists
- DEC-018: Pyramid from day 1 (Vitest + Playwright + Postgres testcontainers) — Phase 0 establishes the test scaffolding so Phase 1+ ship with coverage

### Pending Todos

None yet.

### Blockers/Concerns

- **Vercel CLI version drift** — local Vercel CLI is 50.44, current is 52.0. Update with `pnpm add -g vercel@latest` before `vercel link` in Phase 0 (per HANDOFF.md note)
- **Vercel Marketplace integration for Neon** not yet connected — will be done in Phase 0 via `vercel:marketplace` skill (per HANDOFF.md note)
- **Open spec questions §14** to resolve at implementation time (none are blockers): notification opt-out UX (decided: global only), poster aspect ratio (recommended 4:5), address geocoding (manual lat/lon v1), GDPR cookie banner (yes day 1 — folded into REQ-quality-bar), sitemap.xml (basic auto-gen)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — net-new project)* | | | |

## Session Continuity

Last session: 2026-04-28 16:00
Stopped at: `.planning/` bootstrap complete (PROJECT + REQUIREMENTS + ROADMAP + STATE written from intel synthesis); 14/14 REQ-* mapped, 22/22 DEC-* locked, 7/7 CON-* reflected
Resume file: None — next action is `/gsd-plan-phase 0`
