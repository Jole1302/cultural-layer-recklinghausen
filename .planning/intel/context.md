# Context (synthesized from classified docs)

Topic-keyed running notes from DOC-flavoured material. Each entry preserves source attribution.

Single source: `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` (SPEC) — sections 1, 2, 9, 12, and 14 carry context-grade material that is not itself a binding decision/requirement/constraint.

---

## Topic: Problem & target market

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§1)
- **notes:**
  - Category: event/culture marketplace for chamber-scale niche events
  - Target: Kreis Recklinghausen / Ruhrgebiet (5–7 cities in one Kreis: Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel + neighbours)
  - Strategic context: Berlin-style de-aggregation (the assumption baked into the Berlin PRD v3.0) DOES NOT WORK in Recklinghausen. Region does not suffer from event over-supply — it has a **deficit**. Artists cannot draw an audience even for free; venues do not know they are needed.
  - Primary risk = cold-start, NOT intermediary commissions
  - v1 framing: **supply-creation marketplace** with symmetric bilateral matchmaking. Either side initiates; both must confirm.
  - Curator function (bootstrapping first events) is performed by the platform owner outside the product (offline)
  - Berlin market is post-PMF in Ruhr (deferred, not abandoned)

---

## Topic: Personas — qualitative detail beyond role definitions

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§2)
- **notes:**
  - **Public/Visitor:** Ruhr resident 25–40, "culturally hungry". Often Lokalpatriot supporting local scene, NOT Berlin-style hipster.
  - **Artist:** Semi-pro 22–45 — musician, reader, performer, artist. Does not pay to publish. No commission in v1.
  - **Venue Owner:** 30–55 — loft, studio, Zeche, gallery, workshop. Small non-traditional spaces. In Ruhr, often a curator of a former industrial site.
  - **Admin:** Single account in v1. Provisioned via ENV. Backoffice tool, not a public role with marketing pages.

---

## Topic: Cold-start strategy — operational rationale

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§9)
- **notes:**
  - Principle: without disciplined go-to-market, the platform looks dead. This is not a feature, it is operational practice.
  - The five tactics (waitlist-on-empty, offline curator onboarding, anchor partnership, seed posts, alive metric) are documented in `constraints.md` CON-cold-start-operational. Their **rationale** is recorded here:
    - Waitlist over empty feed prevents the "ghost town" perception that kills supply-side trust
    - Offline onboarding (call/visit) gets the first 2–3 venues + 5 artists committed before any code-level invite path is required
    - Anchor partnership exchanges venue space for committed audience+artist sourcing — solves both sides at once for the launch event
    - Seed posts target the channels Ruhr Lokalpatrioten actually use (Instagram `ruhr_art`, WhatsApp local groups)
    - Alive metric (≥ 1 RSVP'd event/week) is the kill-switch: if missed, pause growth rather than push for false expansion

---

## Topic: Risks — known unknowns

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§12)
- **notes:**

| # | Risk | Mitigation |
|---|---|---|
| 1 | Cold-start fail — empty platform | §9 — do not launch without 2 PUBLISHED events |
| 2 | Artists/venues default to WhatsApp | `event_messages` UX must be faster than switching apps |
| 3 | iOS Safari + camera in PWA is finicky | Early iPhone testing + manual-typing fallback |
| 4 | Magic link in spam folder → user thinks "broken" | Pre-warm Resend domain, in-page instructions, resend after 30s |
| 5 | Single admin = SPOF | Post-v1: multi-admin with promotion from ENV |
| 6 | WCAG ↔ magazine aesthetic conflict | A11y-first markup; magazine treated as a CSS layer |
| 7 | Vercel Blob limit on bulk artist uploads | Per-user file count limit; signed-URL TTL |
| 8 | Bootstrap flag forgotten ON | Cron checks `ENABLE_BOOTSTRAP` after 8 weeks and alerts |

---

## Topic: Open questions — to revisit at implementation time

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§14)
- **notes:** These are NOT spec blockers, but will surface during implementation:
  1. **Notification preferences UX** — can users disable specific email types? (v1 = no, only global opt-out via footer link)
  2. **Event poster image proportions** — fixed 4:5 aspect ratio? (recommended yes, magazine look requires it)
  3. **Venue address validation** — Google Maps API geocoding or manual? (v1 = manual; user enters lat/lon if they want)
  4. **GDPR cookie banner** — required from day 1? (yes; this NFR is carried over from the Berlin PRD)
  5. **Sitemap / SEO** — auto-generated from PUBLISHED events? (yes; basic `sitemap.xml`)

---

## Topic: Effort estimate

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (§15)
- **notes:** Estimated total v1 effort: **150–200 hours**. The spec instructs that the next step is `superpowers:writing-plans` for an implementation plan, decomposed into GSD-workflow phases (`/gsd-spec-phase` → `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` per phase), with goal-backward verification and quality gates after each phase.

---

## Topic: Authorship / provenance

- **source:** docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md (header)
- **notes:**
  - Date: 2026-04-28
  - Status: APPROVED — ready for implementation plan
  - Author: Jakob + Claude (brainstorming session, id `935f8c9b`)
  - Methodology: `superpowers:brainstorming` protocol
  - Reference (context-only): Berlin PRD v3.0 at `.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md`
