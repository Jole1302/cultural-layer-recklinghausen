---
phase: 01-auth-profiles
phase_number: 1
phase_name: Auth & Profiles
created: 2026-05-04
purpose: Capture implementation decisions for downstream researcher and planner
---

# Phase 1: Auth & Profiles — Context

## Domain

Phase 1 delivers the **identity layer**: a real human can request a magic link from a role-specific signup page, click it, land authenticated as `artist` or `venue`, complete a hard-gated profile (with portfolio/photo uploads via Vercel Blob), and be correctly admitted to or denied from `/artist/*`, `/venue/*`, `/admin/*`, `/me` based on their role — with replay-safe tokens and Resend bounce handling already in place.

This is the foundation Phase 2+ depends on for any user-initiated action. After Phase 1, every authenticated request has a known role; every public profile page has real content.

## Carried Forward (Locked from Earlier Decisions)

From PROJECT.md `## Key Decisions` and Phase 0 SUMMARY.md:

- **DEC-006** UI language: **German only** in v1 (no i18n switcher; all copy in DE)
- **DEC-008** Auth: Better Auth email + magic link, 15min TTL, single-use, post-use invalidation
- **DEC-011** File storage: Vercel Blob (public-read + signed upload URL flow)
- **DEC-014** Email: Resend; bounce webhook → `users.status='email_invalid'`
- **DEC-016** UI: Tailwind 4 + shadcn/ui base + magazine-CSS overlay; a11y-first
- **DEC-022** Explicitly rejected: OAuth, phone auth, Firebase, Cloudinary, Edge runtime
- **Phase 0 provisioned:** Better Auth scaffold (`src/lib/auth.ts`, `auth-client.ts`, `/api/auth/[...all]`), 4 Better Auth tables (`user`, `session`, `account`, `verification`), `magic_link_tokens` table, `audit()` helper, env vars (BETTER_AUTH_SECRET/URL, RESEND_API_KEY) live across Dev/Preview/Prod, design contract `docs/design-contract/tone-of-voice.md`

## Locked Requirements

From REQUIREMENTS.md (acceptance criteria are non-negotiable):

- **REQ-roles-rbac** — 4 roles (`public`, `artist`, `venue`, `admin`); single ENV-provisioned admin; route gates per role
- **REQ-magic-link-auth** — Resend delivery; `tokenHash` HMAC; 15min TTL; single-use (consumedAt); 10/min/IP rate limit; bounce webhook flips `users.status='email_invalid'` and blocks further sends
- **REQ-profile-uploads** — Artist `portfolioBlobs jsonb [{url, alt, order}]`; Venue `photoBlobs jsonb [{url, alt}]`; signed URL TTL on upload; per-user file count limit

## Decisions (this discussion)

### D-1.1 — Role assignment via separate signup landing pages

**Decision:** **Two role-specific landing pages: `/artist/signup` and `/venue/signup`**. Each has its own copy + tone-of-voice (per design contract), collects email, sends a magic link that carries the role in the token payload. After verify, role is written to `users.role` from the token, never from request input.

`/login` remains the universal "I already have an account" path for returning users (any role).

**Rationale:** More marketing-friendly (separate hero copy per audience), zero ambiguity in user mental model, matches the "one-side-at-a-time" landing experience the founder is designing for. Cost: 2 landing routes instead of 1, but role-specific copy is needed for marketing anyway.

**Implementation guidance for planner:**
- Magic-link token payload: `{ email, role: 'artist' | 'venue', issuedAt }`. Server-side validation: token's `role` becomes `users.role` exactly once (on first verify, when current `users.role = 'public'` or user does not yet exist).
- Returning users: `/login` issues a magic-link without role in payload — verify uses existing `users.role`.
- `/artist/signup` and `/venue/signup` are public anonymous routes (per REQ-roles-rbac route gates).
- Admin role NEVER assignable via signup path (REQ-roles-rbac SC#4) — admin is ENV-provisioned only.

### D-1.2 — Profile upload limits

**Decision:**
- **Artist portfolio:** max **10** images, **5MB each**, **JPEG/PNG/WebP only**
- **Venue photos:** max **8** images, **5MB each**, **JPEG/PNG/WebP only**
- **Event poster (Phase 2 will use):** single image, same constraints

**Rationale:** Artist portfolio of 10 = enough for a meaningful selection without feeling sparse; venue 8 = interior + stage + exterior + a few extras. 5MB cap balances quality (modern smartphone JPEGs ~3-4MB) against Vercel Blob cost. Raster-only — vector formats deferred (poster spec doesn't call for SVG).

**Implementation guidance for planner:**
- Validation **server-side at signed-URL issuance** (count + content-type from Blob clientPayload). Client-side preview-only check is friendly UX but never trusted.
- `posterBlob` URL field exists on `event_proposals` and `events` (Phase 2) — Phase 1 just reserves the column type via the Blob upload component (reused).
- File-count enforcement: `COUNT(portfolioBlobs)` server-side before issuing upload URL; reject with 400 if at limit.
- Image type enforcement: Vercel Blob `clientPayload.contentType` whitelist `['image/jpeg','image/png','image/webp']`.

### D-1.3 — Profile completion gate: HARD redirect

**Decision:** **Hard gate.** Until required profile fields are filled, every request to `/artist/*` or `/venue/*` (except `/me/edit`, `/api/auth/*`, and signed-Blob upload endpoints) **redirects to `/me/edit`**.

Required fields for completeness:
- **Artist:** `displayName` (1-80 chars), `bio` (10-1000 chars). Optional: Instagram handle, website URL.
- **Venue:** `name`, `address`, `capacity` (positive integer), at least 1 photo uploaded.

**Rationale:** Protects Phase 4 public feed quality from the start — no empty / bot-looking profiles surface to visitors. Forcing completion at first login matches "we're a curated marketplace" framing of the project. Phase 2 lifecycle already assumes profiles are non-empty when proposals/listings get created.

**Implementation guidance for planner:**
- Single middleware (or `/artist`, `/venue` layout `redirect()` call) checks `profileComplete` flag derived from required fields.
- `users.profileComplete` is a **derived boolean** (NOT a stored column) computed in middleware/layout — avoids drift if rules change.
- `/me/edit` is universally accessible to authenticated users regardless of role/state.
- Banner UX after completion: green "Profil vollständig — du kannst jetzt Vorhaben veröffentlichen" toast on first save (one-time, dismissed forever).

### D-1.4 — Magic-link error states with explicit CTAs

**Decision:** **Three distinct states** at `/auth/verify` with named copy + CTA per state, all logged to `audit_log`.

| State | Detection | Copy (DE) | CTA | Audit |
|-------|-----------|-----------|-----|-------|
| Used (replay) | `consumedAt IS NOT NULL` | "Link bereits verwendet — du bist vermutlich schon eingeloggt." | "Zum Login" → `/login` | `magic_link.replay_attempt` |
| Expired | `expiresAt < now()` AND `consumedAt IS NULL` | "Link abgelaufen — fordere einen neuen an." | "Neuen Link anfordern" → re-prompts email | `magic_link.expired` |
| Invalid (HMAC mismatch / no row) | row not found OR HMAC fails | "Ungültiger Link." | "Zurück zur Anmeldung" → `/login` | `magic_link.invalid` |

**Rationale:** REQ-magic-link-auth SC#4 mandates the "Link bereits verwendet" copy explicitly — the other two states are natural refinements. Clear differentiation tells the user what to do; generic error invites support tickets. Auditing all three gives admin/security visibility into replay attempts (potential phishing forwards) and expired-link rate (potential email-delivery latency).

**Implementation guidance for planner:**
- Verify path: row lookup by `tokenHash` first; if no row → invalid. If row → HMAC re-verify (Better Auth handles this); if mismatch → invalid. Then check `consumedAt`, then `expiresAt`. Order matters for audit precision.
- All three branches write to `audit_log` with `actorUserId = users.id` if `email` resolves, else NULL. Include `actorIp` if Phase 7 column-add lands first; otherwise just `action` + `metadata.email_hash`.
- Auto-resend on expired (option C from discussion): NOT chosen — it opens an enumeration vector and was rejected. Manual "Neuen Link anfordern" only.

## Open Questions Surfaced (for researcher)

These don't block Phase 1 start but the researcher (`/gsd-research-phase 1`) should resolve before plan finalises:

1. **Better Auth magic-link plugin vs custom magic-link table** — Better Auth ships its own magic-link plugin; we ALSO have `magic_link_tokens` in our schema (Phase 0). Researcher: pick one path (likely Better Auth's plugin with our table as the persistence target via custom storage adapter, OR our table only with Better Auth as just session manager). Document the integration shape.

2. **Vercel Blob signed-upload concurrency** — when artist uploads 10 images in parallel, does signed-URL generation rate-limit? What's the recommended pattern (sequential client-side queue vs parallel with backoff)?

3. **Resend bounce webhook authentication** — what's the signing secret pattern? Where to store the verifier? Webhook URL pattern under `/api/auth/...` or separate `/api/webhooks/resend/bounce`?

4. **profileComplete computation cost** — middleware runs on every request to `/artist/*` `/venue/*`. Is `users.profileComplete` worth a single-source view (Postgres generated column) vs SQL function vs application-layer derivation? Researcher to benchmark.

## Non-Decisions (deferred)

These were considered but not decided in this discussion — listed so planner doesn't relitigate:

- **i18n switcher** — explicitly out per DEC-006 (DE-only v1). Backlog item if visitor traffic shows EN demand.
- **OAuth (Google, Apple)** — explicitly rejected per DEC-022.
- **Profile soft-delete / reactivation flow** — Phase 7 (admin moderation) territory.
- **Portfolio reordering UX** — Phase 1 stores `order` field; the actual drag-handle UI may slip to Phase 3 (dashboards) if Phase 1 plan budget is tight. Plan can decide.
- **Rate-limit response shape** — REQ says "429 after 11th attempt"; the response body shape (JSON error vs plain text vs RFC 7807) is implementation detail for the planner.

## Canonical refs

These docs MUST be read by researcher / planner before producing Phase 1 PLAN.md:

- `.planning/PROJECT.md` — DEC-001..DEC-022, especially DEC-006/008/011/014
- `.planning/REQUIREMENTS.md` lines 16–42 — full acceptance criteria for the 3 Phase-1 REQs
- `.planning/ROADMAP.md` — Phase 1 success criteria 1–7
- `.planning/phases/00-skeleton-infra/00-01-SUMMARY.md` — what Phase 0 already delivered (Better Auth scaffold, `audit()` helper, env vars, schema)
- `.planning/phases/00-skeleton-infra/00-PLAN.md` — files-modified manifest (so planner doesn't re-create existing files)
- `docs/design-contract/tone-of-voice.md` — copywriting voice for landing pages, error states, CTAs
- `docs/runbook.md` — Phase 0 deploy + on-call procedures (any new envs/cron go here)
- `node_modules/next/dist/docs/` — Next.js 16 reference (per AGENTS.md "this is NOT the Next.js you know")
- Better Auth docs — magic-link plugin specifically; researcher decides path per Open Question 1

## Next steps

1. `/gsd-research-phase 1` — research Better Auth magic-link integration, Vercel Blob signed-upload pattern, Resend bounce webhook signing, profileComplete computation strategy
2. `/gsd-plan-phase 1` — produce PLAN.md anchored to the 4 decisions + 4 open-question resolutions above
3. `/gsd-execute-phase 1` — implement
4. `/gsd-verify-work` — UAT against ROADMAP Phase 1 success criteria
