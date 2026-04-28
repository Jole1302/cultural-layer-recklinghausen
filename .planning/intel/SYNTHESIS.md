# Synthesis Summary

Entry point for downstream consumers (notably `gsd-roadmapper`).

---

## Ingest set

- **Mode:** new (net-new bootstrap; `.planning/imports/` is reference material only, not authoritative spec)
- **Docs synthesized:** 1 total
  - SPEC: 1
  - PRD: 0
  - ADR: 0 (but 12 ADR-equivalent decisions extracted from SPEC §13; 10 additional locked decisions extracted from SPEC §7 "Tech stack (locked)" — see Notes below)
  - DOC: 0
- **Cross-ref cycles detected:** 0
- **UNKNOWN-confidence-low docs:** 0

Source manifest:

- `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` — SPEC, status APPROVED, classified high-confidence by `2026-04-28-recklinghausen-event-platform-design-4d8b1c2a.json`. Single cross-reference to `.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md` (context-only reference, not in ingest set).

---

## Per-type intel files (in `.planning/intel/`)

- `decisions.md` — **22 locked decisions** (DEC-001 through DEC-022)
  - DEC-001..DEC-012: 12 decisions from SPEC §13 decisions log (target market, codebase strategy, wedge, geo filter, artist verification, UI language, capacity policy, auth, DB, ORM, files, real-time)
  - DEC-013..DEC-021: 9 framework/infrastructure decisions from SPEC §7 ("(locked)" tech stack table) (Next.js+React, Resend, Zod, UI base, QR libs, test toolchain, Sentry, CI/CD, hosting)
  - DEC-022: rejected-tech list (Firebase, Cloudinary, Stripe-in-v1, web-push, microservices, Edge runtime, Turbo monorepo)
- `requirements.md` — **14 requirements** with stable IDs:
  - REQ-roles-rbac
  - REQ-magic-link-auth
  - REQ-bilateral-marketplace-state-machine
  - REQ-event-proposals
  - REQ-venue-listings
  - REQ-rsvp-qr-ticketing
  - REQ-qr-checkin-scanner
  - REQ-public-feed
  - REQ-dashboards
  - REQ-email-notifications
  - REQ-profile-uploads
  - REQ-admin-moderation
  - REQ-audit-log
  - REQ-quality-bar
  - REQ-out-of-scope-v1 (scope guard, lists 16 explicit exclusions)
- `constraints.md` — **7 constraint blocks** by type:
  - CON-data-model (schema): 10-table Drizzle model + day-1 indexes + DB invariants
  - CON-tech-stack (stack contract): summary table + rejected list
  - CON-routes (api-contract): ~25 routes across public/artist/venue/admin
  - CON-state-machine (protocol): event lifecycle + transitions + concurrency rule
  - CON-quality-nfrs (nfr): 9 day-1 quality gates
  - CON-edge-cases (protocol): 9 mandated error-handling behaviours
  - CON-cold-start-operational (protocol): launch-policy gate (in-code + operational)
  - CON-spec-context-pointer (scope guard): Berlin PRD is context-only, not scope source
- `context.md` — **6 topic blocks**: problem & market, personas qualitative detail, cold-start rationale, risks, open questions, effort estimate, provenance

---

## Conflicts summary

- **Blockers:** 0
- **Competing variants:** 0
- **Auto-resolved:** 0
- **INFO entries:** 1 (transparent record of the SPEC §13 / §7 → locked-decisions promotion)

Detail: `.planning/INGEST-CONFLICTS.md`

---

## Notes for downstream consumers

1. **Single-doc ingest, single-author spec.** No inter-doc conflict surface exists in this batch. Future ingests that touch the same scope (e.g., a follow-up ADR amending DEC-009 datastore choice) will be checked against these locked decisions.
2. **SPEC §13 promoted to locked decisions.** This is per orchestrator instruction. The parent SPEC is APPROVED, the section is explicitly framed as a decisions log fixed during a brainstorming session, and section 7's tech stack table is labelled "(locked)". Treat DEC-001..DEC-022 as if they were Accepted ADRs — any future ingest that contradicts them must be classified as a BLOCKER (LOCKED-vs-LOCKED) unless one is first marked superseded.
3. **Berlin PRD is context-only.** The Berlin PRD in `.planning/imports/` is referenced by the spec header explicitly as context, NOT scope source. The roadmapper should not pull requirements from it. The single carry-over is the GDPR cookie banner NFR (per §14 open question 4).
4. **Out-of-scope list is binding.** REQ-out-of-scope-v1 enumerates 16 items the v1 plan must not contain. Treat scope-creep into any of these as a planning error.
5. **Operational gate is partly in-code.** CON-cold-start-operational has both code-enforced rules (waitlist on `<2` published, ENV-flag bootstrap, 8-week cron alert) and operational policy (offline curator onboarding, anchor partnership). The roadmapper should plan the code-enforced parts; the operational parts are recorded for transparency only.
6. **Two ambiguities flagged for the roadmapper but not as conflicts:**
   - REQ-email-notifications acceptance refers to "global opt-out via footer link" per §14 open question 1 — implementation must include this
   - CON-spec-context-pointer notes the GDPR cookie banner carry-over from Berlin PRD per §14 open question 4

---

## Status

**READY — safe to route to `gsd-roadmapper`.** No user input required.
