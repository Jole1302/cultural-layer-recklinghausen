# Cultural Layer — PRD v3.0 (Berlin reference)

**Imported:** 2026-04-28
**Source:** Pasted by user during brainstorming session for Recklinghausen v1
**Status in current project:** REFERENCE ONLY — Recklinghausen v1 is a strategically different product

## Quick summary

- **Brownfield:** PRD claims 75% complete (14,422 LOC, 76 TS files). Codebase location unknown (NOT in /projects/app, which is `day45-mvp` PWA).
- **Stack:** Next.js 14 App Router + Firebase (Firestore + Phone Auth) + Stripe + Cloudinary + Resend + Vercel.
- **Pilot:** 50 users invite-only, free tickets first, 3 partner venues seed, then €10–20 paid beta.
- **Revenue split:** 70 artist / 20 venue / 10 platform.
- **Aesthetic:** "Brutalist warmth" — terracotta #C05D43, paper #F8F5F0, ink #33302E. Merriweather + Inter. Mobile-first PWA. German UI.
- **Roles:** CLIENT, ARTIST, VENUE, ADMIN. PENDING approval gate.
- **Quality gaps known:** 0% test coverage, N+1 queries, webhook non-idempotency, WCAG violations, 3MB initial load.
- **8 epics, 42 stories, 244h estimated effort, 12-week timeline.**

## What translates to Recklinghausen v1

- Aesthetic & brand language (Gegen den Lärm) — works in Ruhr too if we anchor it on industrial heritage instead of Kreuzberg cool.
- Roles & data model (CLIENT/ARTIST/VENUE/ADMIN) — same primitives.
- QR ticketing + scanner — same, copy-pasteable feature.
- Revenue split logic — keep, even if v1 is free.
- Mobile-first PWA target — same.
- Quality gates (testing pyramid, Sentry, accessibility) — apply from day one, don't repeat Berlin's debt.

## What does NOT translate (Recklinghausen-specific changes)

| Berlin assumption | Recklinghausen reality | v1 implication |
|---|---|---|
| Invite-only PENDING (filter excess supply) | Need MORE supply, not less | No PENDING gate v1 — open onboarding |
| Artist creates event → finds venue | Few artists, many idle venues | Flip: Venue Owner is primary, "Aktiviere deinen Raum" wedge |
| Discovery via filters (genre, date) | <5 events/month | "Was läuft im Ruhrgebiet?" newsletter-style feed, no filters |
| 70/20/10 split, €10–20 tickets | No volume yet, audience can't pay €15 | Free or "pay what you want" v1, monetize later |
| "5 partner venues, 20 artists" cold-start | Far harder cold-start | Curator-as-a-service: platform team programs first 5 events manually |
| Berlin-centric (Kreuzberg vibe) | Multi-town (Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel…) | Town-level filtering or single Kreis-wide feed |
| Cool-hipster aesthetic | Industrial heritage / Lokalpatriotismus | Anchor on Zechen, Fördertürme, post-Kohle culture |

## Open questions raised by import

1. **Where is the Cultural Layer codebase?** Locally? Git remote? Or only PRD survives?
2. **Fork or greenfield?** If code exists and is reusable, forking saves 60–70% effort but inherits debt. If we go greenfield in `/projects/saas/`, we shed debt but redo auth/QR/dashboards.
3. **Is the team the same (you alone, Antigravity Kit multi-agent)?** PRD attributes work to multiple personas — that affects what we can deliver in v1.
