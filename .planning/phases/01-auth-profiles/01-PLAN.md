---
phase: 01-auth-profiles
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Wave 0 — deps + env schema + pure helpers + audit-type extension + schema comment
  - package.json
  - pnpm-lock.yaml
  - src/lib/env.ts
  - .env.example
  - src/lib/profile-rules.ts
  - src/lib/audit.ts
  - src/db/schema.ts # comment-only deprecation note on magic_link_tokens
  # Wave 1 — auth flow
  - proxy.ts
  - src/lib/dal.ts
  - src/lib/auth.ts
  - src/lib/email/magic-link.tsx
  - src/app/(public)/login/page.tsx
  - src/app/(public)/login/actions.ts
  - src/app/(public)/artist/signup/page.tsx
  - src/app/(public)/artist/signup/actions.ts
  - src/app/(public)/venue/signup/page.tsx
  - src/app/(public)/venue/signup/actions.ts
  - src/app/auth/verify/page.tsx
  - src/app/auth/post-verify/page.tsx
  - scripts/provision-admin.ts
  # package.json (+script provision:admin) — already listed above
  # Wave 2 — profiles + uploads + public views
  - src/app/me/page.tsx
  - src/app/me/edit/page.tsx
  - src/app/me/edit/actions.ts
  - src/app/me/edit/portfolio-uploader.tsx
  - src/app/me/edit/photos-uploader.tsx
  - src/app/api/profile/upload/route.ts
  - src/app/artist/layout.tsx
  - src/app/artist/page.tsx
  - src/app/venue/layout.tsx
  - src/app/venue/page.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/page.tsx
  - src/app/artists/[slug]/page.tsx
  - src/app/venues/[slug]/page.tsx
  # Wave 3 — bounce webhook + audit hardening
  - src/app/api/webhooks/resend/bounce/route.ts
  - docs/runbook.md
  # Wave 4 — verification (test files + CI)
  - tests/setup/mock-resend.ts
  - tests/setup/mock-ratelimit.ts
  - tests/integration/magic-link-helpers.ts
  - tests/integration/svix-helpers.ts
  - tests/unit/profile-rules.test.ts
  - tests/unit/dal.test.ts
  - tests/unit/audit-actions.test.ts
  - tests/unit/env-schema.test.ts
  - tests/integration/magic-link.test.ts
  - tests/integration/upload.test.ts
  - tests/integration/bounce-webhook.test.ts
  - tests/integration/post-verify.test.ts
  - tests/integration/rate-limit.test.ts
  - tests/integration/better-auth-schema-drift.test.ts
  - tests/e2e/auth-flow.spec.ts
  - tests/e2e/route-gates.spec.ts
  - tests/e2e/magic-link-error-states.spec.ts
  - tests/e2e/profile-upload.spec.ts
  - .github/workflows/ci.yml # add better-auth schema-drift job
  - .github/workflows/lighthouse.yml # add /login, /artist/signup, /venue/signup
autonomous: true
requirements:
  - REQ-roles-rbac
  - REQ-magic-link-auth
  - REQ-profile-uploads

must_haves:
  truths:
    - "A user can submit email at /artist/signup or /venue/signup, receive a magic-link email, click it, and arrive at /me with a session"
    - "Clicking the same magic link a second time shows the German 'Link bereits verwendet' message and audits the replay"
    - "A magic-link request from one IP is rejected with 429 after the 11th attempt within a minute"
    - "An authenticated artist gets 200 on /artist, 403 (or redirect) on /venue and /admin; same matrix verifies for venue and admin"
    - "Anonymous visitors get 200 on /, /events, /events/[slug], /artists/[slug], /venues/[slug], /login, /artist/signup, /venue/signup, /auth/verify"
    - "Exactly one admin exists, provisioned via scripts/provision-admin.ts using ADMIN_EMAIL — no signup path produces an admin"
    - "An artist can complete profile (displayName, bio) and upload up to 10 portfolio images at 5MB max, JPEG/PNG/WebP only — 11th upload rejected with 400"
    - "A venue can complete profile (name, address, capacity, ≥1 photo) and upload up to 8 photos with same size/type rules"
    - "Uploaded artist images render publicly on /artists/[slug]; uploaded venue photos render publicly on /venues/[slug]"
    - "A Resend bounce webhook (svix-signed) flips users.status='email_invalid' for the bounced email; subsequent magic-link sends to that address are silently dropped and audited"
    - "An incomplete artist or venue profile is hard-redirected to /me/edit on every /artist/* or /venue/* visit (except /me/edit and signed-Blob upload endpoints)"
  artifacts:
    - path: "proxy.ts"
      provides: "Next.js 16 optimistic session-cookie gate at project root (cookie-only check, NO db queries)"
      contains: "export function proxy"
    - path: "src/lib/dal.ts"
      provides: "Data Access Layer with verifySession (cache-memoized), requireRole, requireCompleteProfile"
      exports: ["verifySession", "requireRole", "requireCompleteProfile", "SessionUser"]
    - path: "src/lib/profile-rules.ts"
      provides: "Pure isArtistComplete and isVenueComplete predicates"
      exports: ["isArtistComplete", "isVenueComplete"]
    - path: "src/app/(public)/artist/signup/page.tsx"
      provides: "Artist signup landing with DE Sie-Form copy and magic-link Server Action carrying role=artist"
    - path: "src/app/(public)/venue/signup/page.tsx"
      provides: "Venue signup landing with DE Sie-Form copy and magic-link Server Action carrying role=venue"
    - path: "src/app/auth/verify/page.tsx"
      provides: "3-state magic-link error UX (used / expired / invalid) with explicit DE copy + per-state CTAs"
    - path: "src/app/auth/post-verify/page.tsx"
      provides: "First-verify role write (gated on current role==='public') with audit_log entry"
    - path: "src/app/api/profile/upload/route.ts"
      provides: "Vercel Blob handleUpload route with auth + per-user count cap + content-type whitelist + size cap"
    - path: "src/app/api/webhooks/resend/bounce/route.ts"
      provides: "Svix-signed bounce webhook flipping users.status='email_invalid' on hard bounces"
    - path: "src/app/me/edit/page.tsx"
      provides: "Profile editor with branched artist/venue forms"
    - path: "src/app/artists/[slug]/page.tsx"
      provides: "Public artist profile rendering portfolioBlobs"
    - path: "src/app/venues/[slug]/page.tsx"
      provides: "Public venue profile rendering photoBlobs"
    - path: "scripts/provision-admin.ts"
      provides: "ENV-driven admin provisioning (ADMIN_EMAIL)"
    - path: "tests/integration/rate-limit.test.ts"
      provides: "Integration coverage for SC#2 — 11th request/min/IP returns 429 + RFC body shape + Retry-After header"
  key_links:
    - from: "src/app/(public)/artist/signup/actions.ts"
      to: "Better Auth signIn.magicLink"
      via: "callbackURL=/auth/post-verify?role=artist (D-1.1)"
      pattern: "signInMagicLink|signIn\\.magicLink"
    - from: "src/lib/auth.ts"
      to: "src/db (users.status check + Resend send)"
      via: "sendMagicLink callback with status pre-flight"
      pattern: "sendMagicLink"
    - from: "src/app/auth/post-verify/page.tsx"
      to: "users.role UPDATE"
      via: "gated on current role==='public'"
      pattern: "user\\.role === 'public'"
    - from: "proxy.ts"
      to: "session cookie presence only"
      via: "request.cookies.get (NO db query, optimistic check only)"
      pattern: "cookies\\.get"
    - from: "src/app/artist/layout.tsx"
      to: "src/lib/dal.ts requireRole + requireCompleteProfile"
      via: "Server Component layout calls"
      pattern: "requireRole|requireCompleteProfile"
    - from: "src/app/api/profile/upload/route.ts"
      to: "artist_profiles.portfolioBlobs / venue_profiles.photoBlobs"
      via: "handleUpload onBeforeGenerateToken count gate + onUploadCompleted JSONB append"
      pattern: "handleUpload|portfolio_blobs|photo_blobs"
    - from: "src/app/api/webhooks/resend/bounce/route.ts"
      to: "users.status='email_invalid'"
      via: "svix.Webhook.verify(rawBody, svixHeaders) then UPDATE users"
      pattern: "Webhook|svix"
    - from: "src/lib/auth.ts sendMagicLink"
      to: "audit_log (magic_link.suppressed_invalid_email)"
      via: "users.status pre-flight check before Resend.emails.send"
      pattern: "status === 'email_invalid'"
---

<objective>
Phase 1 wires identity and profiles onto the Phase 0 skeleton. A real human can request a magic link from a role-specific signup page (`/artist/signup` or `/venue/signup`) or universal `/login`, click the link, land authenticated as the correct role, complete a hard-gated profile (with portfolio/photo uploads via Vercel Blob), and be correctly admitted to or denied from `/artist/*`, `/venue/*`, `/admin/*`, `/me` based on their role — with replay-safe tokens, role-specific 3-state error UX, and Resend bounce handling already in place.

Purpose: deliver REQ-roles-rbac (4-role RBAC, ENV-provisioned admin, route gates), REQ-magic-link-auth (Resend delivery, HMAC-hashed token, 15min TTL, single-use, 10/min/IP rate limit, bounce → email_invalid), REQ-profile-uploads (artist/venue media via signed Vercel Blob URLs with per-user count caps).

Output: a new `proxy.ts` (Next.js 16) at repo root, a Data Access Layer in `src/lib/dal.ts`, role-specific signup/login/verify/post-verify pages, profile editors with parallel-upload client components, an authenticated `/api/profile/upload` Vercel Blob handler, a svix-verified Resend bounce webhook, public `/artists/[slug]` + `/venues/[slug]` views, an ENV-driven admin provisioning script, and a full Vitest + Playwright + axe test suite for role gates, error states, upload limits, and the 11th-request rate-limit response.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-auth-profiles/01-CONTEXT.md
@.planning/phases/01-auth-profiles/01-RESEARCH.md
@.planning/phases/00-skeleton-infra/00-01-SUMMARY.md
@docs/design-contract/tone-of-voice.md
@AGENTS.md
@CLAUDE.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase + research. -->
<!-- Executor uses these directly — no codebase exploration needed. -->

From src/lib/audit.ts (Phase 0):
```typescript
// audit({ actorUserId, action, target, meta }) — actorUserId may be null for system events
// Phase 1 adds these action literal types (extend the union):
//   'magic_link.issued'
//   'magic_link.replay_attempt'
//   'magic_link.expired'
//   'magic_link.invalid'
//   'magic_link.suppressed_invalid_email'
//   'user.role_assigned'
//   'user.email_invalid'
//   'user.profile_completed'
//   'user.profile_updated'
```

From src/lib/auth.ts (Phase 0):
```typescript
// Already wired:
//   - betterAuth() with drizzleAdapter
//   - magicLink plugin with expiresIn: 60 * 15
//   - sendMagicLink callback that calls Resend
//   - databaseHooks.user.create.after — mirrors Better Auth user → domain users with role='public'
// Phase 1 modifies:
//   - Add storeToken: 'hashed'
//   - Rewrite sendMagicLink callback for status pre-flight + DE template + audit
```

From src/lib/ratelimit.ts (Phase 0):
```typescript
// Already exports magicLinkLimit (10/min sliding window, Upstash-backed)
// Phase 1 imports in /login, /artist/signup, /venue/signup Server Actions
```

From src/lib/env.ts (Phase 0):
```typescript
// Eager Zod parse at module load. Phase 1 adds:
//   RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_')
//   ADMIN_EMAIL: z.string().email().optional()
// (ADMIN_EMAIL kept optional so dev environments without admin can still boot)
```

From src/db/schema.ts (Phase 0, locked — DO NOT modify columns):
```typescript
// users (Phase 0): id, email, role enum('public','artist','venue','admin'),
//   status enum('active','suspended','email_invalid'), createdAt, updatedAt
// artist_profiles: userId (PK FK), displayName, bio, instagramHandle, websiteUrl,
//   portfolioBlobs jsonb [{url, alt, order}], createdAt, updatedAt
// venue_profiles: userId (PK FK), name, addressStreet, addressCity, addressZip,
//   lat, lon, capacity, photoBlobs jsonb [{url, alt}], createdAt, updatedAt
// magic_link_tokens (Phase 0, dormant in Phase 1): keep table; add deprecation comment ONLY
```

Profile completion rules (D-1.3, computed in src/lib/profile-rules.ts):
```typescript
// Artist complete iff:
//   displayName !== null && length in [1,80]
//   bio !== null && length in [10,1000]
// Venue complete iff:
//   name !== null && addressStreet !== null
//   capacity !== null && capacity > 0
//   photoBlobs.length >= 1
```

Upload limits (D-1.2, enforced server-side in /api/profile/upload):
```typescript
const LIMITS = { artist: 10, venue: 8 } as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
```

Better Auth flow (per RESEARCH §2.1):
```typescript
// Issuance: signIn.magicLink({ email, callbackURL: '/auth/post-verify?role=artist' })
// Verify: Better Auth handles at /api/auth/magic-link/verify → redirects to callbackURL
// Failure: callbackURL receives ?error=ATTEMPTS_EXCEEDED (or other error codes)
// Phase 1 wraps verify failure landing in /auth/verify page that disambiguates:
//   - row not found → 'invalid'
//   - row exists with consumedAt OR ATTEMPTS_EXCEEDED error → 'used'
//   - row exists with expiresAt < now() and not consumed → 'expired'
```

Magic-link 3-state copy (D-1.4, DE Sie-Form per tone-of-voice §3.4):
```
| State    | Copy                                                          | CTA                          |
|----------|---------------------------------------------------------------|------------------------------|
| used     | "Link bereits verwendet — Sie sind vermutlich schon angemeldet." | "Zum Login" → /login         |
| expired  | "Link abgelaufen — fordern Sie einen neuen an."                | "Neuen Link anfordern" → /login |
| invalid  | "Ungültiger Link."                                              | "Zurück zur Anmeldung" → /login |
```

Rate-limit response shape (locked in this plan; SC#2):
```typescript
// HTTP 429
// Body: { error: 'rate_limit', retryAfter: <number_of_seconds_until_reset> }
// Header: Retry-After: <number_of_seconds_until_reset>
```
</interfaces>
</context>

<tasks>

<!--
WAVE 0 — deps + env schema + pure helpers + audit-type extension + schema comment.
All independent of each other and of Wave 1; can run in parallel within Wave 0.
-->

<task type="auto">
  <name>T-01 (Wave 0): Install @vercel/blob and svix</name>
  <files>package.json, pnpm-lock.yaml</files>
  <action>Run `pnpm add @vercel/blob svix`. Both packages confirmed missing in package.json as of Phase 1 start (RESEARCH §4 + verified). Pin no specific minor — accept latest at install time, then capture in lockfile. Per D-1.2 + RESEARCH §2.2, `@vercel/blob` is the official Vercel Blob SDK with `handleUpload` server-side and `upload` client-side. Per RESEARCH §2.3, `svix` is the official webhook verification library Resend webhooks use.</action>
  <verify>
    <automated>pnpm list @vercel/blob svix --depth=0 | grep -E '@vercel/blob|svix' | wc -l | grep -q '^2$'</automated>
  </verify>
  <done>package.json dependencies includes both packages; pnpm-lock.yaml updated; `pnpm install` is clean (no resolution warnings).</done>
</task>

<task type="auto">
  <name>T-02 (Wave 0): Pin better-auth and add CI schema-drift check (per D-1.4 + RESEARCH §5d)</name>
  <files>package.json, .github/workflows/ci.yml, tests/integration/better-auth-schema-drift.test.ts</files>
  <action>Verify `better-auth` in package.json is pinned to exact version `1.6.9` (no ^ or ~ — research confirmed this is already pinned; assert it stays pinned in CI). Add a new vitest integration test `tests/integration/better-auth-schema-drift.test.ts` that runs `npx --yes @better-auth/cli@1.6.9 generate --output /tmp/expected-better-auth.sql` and diffs against `drizzle/0001_better_auth.sql` (whitespace-normalized). Test fails if diff is non-empty. Add a CI job in `.github/workflows/ci.yml` named `better-auth-schema-drift` that runs only this test (so a Better Auth bump that drifts schema fails CI before merge). MISSING — Wave 0 must create this test.</action>
  <verify>
    <automated>pnpm vitest run tests/integration/better-auth-schema-drift.test.ts</automated>
  </verify>
  <done>Test file exists; CI workflow has `better-auth-schema-drift` job that depends on the same setup as the existing `vitest` job; test passes against current `drizzle/0001_better_auth.sql`; package.json shows exact `"better-auth": "1.6.9"`.</done>
</task>

<task type="auto" tdd="true">
  <name>T-03 (Wave 0): Extend src/lib/env.ts schema with RESEND_WEBHOOK_SECRET and ADMIN_EMAIL</name>
  <files>src/lib/env.ts, .env.example, tests/unit/env-schema.test.ts</files>
  <behavior>
    - env.RESEND_WEBHOOK_SECRET parses correctly when value starts with `whsec_`
    - env parse throws when RESEND_WEBHOOK_SECRET is set but does NOT start with `whsec_`
    - env.ADMIN_EMAIL is optional (parses when undefined; parses when valid email; throws when invalid email)
  </behavior>
  <action>Per RESEARCH §3.5 + D-1.4: extend the existing Zod schema in `src/lib/env.ts` with `RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_')` (required in production). Add `ADMIN_EMAIL: z.string().email().optional()` (kept optional so dev environments without an admin can boot — RESEARCH §3.6). Add both vars to `.env.example` with placeholder values. Add a unit test (RED first) confirming the schema enforces both shapes. Per Phase 0 SUMMARY, env is eagerly parsed at module load — make sure CI dummy-env step in `.github/workflows/ci.yml` already provides RESEND_WEBHOOK_SECRET=whsec_dummy (extend the env block).</action>
  <verify>
    <automated>pnpm vitest run tests/unit/env-schema.test.ts</automated>
  </verify>
  <done>Both vars present in Zod schema; .env.example updated; unit test passes; `pnpm typecheck` clean.</done>
</task>

<task type="auto" tdd="true">
  <name>T-04 (Wave 0): Create src/lib/profile-rules.ts (pure predicates per D-1.3)</name>
  <files>src/lib/profile-rules.ts, tests/unit/profile-rules.test.ts</files>
  <behavior>
    - isArtistComplete returns false for null displayName / null bio
    - isArtistComplete returns false for displayName length 0 or 81; bio length 9 or 1001
    - isArtistComplete returns true for displayName length 1, 80; bio length 10, 1000
    - isVenueComplete returns false when name/addressStreet/capacity is missing or capacity <= 0
    - isVenueComplete returns false when photoBlobs is null OR length 0
    - isVenueComplete returns true with name + addressStreet + capacity=1 + 1 photoBlob
  </behavior>
  <action>Write tests FIRST (RED) covering all boundary cases above. Then implement two pure functions: `isArtistComplete(p: { displayName: string | null; bio: string | null }): boolean` and `isVenueComplete(p: { name: string | null; addressStreet: string | null; capacity: number | null; photoBlobs: Array<{ url: string }> | null }): boolean`. No imports — pure logic only. Per RESEARCH §2.4, this file is the single source of truth for completion rules; keeps DAL clean and prevents Postgres-generated-column drift. Independent of all other Wave 1 files; runs in Wave 0 as a foundation.</action>
  <verify>
    <automated>pnpm vitest run tests/unit/profile-rules.test.ts</automated>
  </verify>
  <done>14+ test cases pass; both predicates are pure (no side effects); both exported.</done>
</task>

<task type="auto">
  <name>T-05 (Wave 0): Extend src/lib/audit.ts action literal union with Phase 1 actions</name>
  <files>src/lib/audit.ts, tests/unit/audit-actions.test.ts</files>
  <action>Per RESEARCH §4 EXTEND-row-1 and D-1.4: extend the existing `action` literal type union in `src/lib/audit.ts` to include the 9 Phase-1 actions: `magic_link.issued`, `magic_link.replay_attempt`, `magic_link.expired`, `magic_link.invalid`, `magic_link.suppressed_invalid_email`, `user.role_assigned`, `user.email_invalid`, `user.profile_completed`, `user.profile_updated`. Do NOT change the helper signature; only widen the type. Add a unit test that imports the action type and asserts each new literal is assignable (compile-time + runtime spot check via a typed array). Independent of other tasks; runs in Wave 0.</action>
  <verify>
    <automated>pnpm vitest run tests/unit/audit-actions.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>Type union includes all 9 new literals; existing audit() callers compile unchanged; test passes.</done>
</task>

<task type="auto">
  <name>T-06 (Wave 0): Add deprecation comment to magic_link_tokens declaration in src/db/schema.ts</name>
  <files>src/db/schema.ts</files>
  <action>Per RESEARCH §5h: add a comment near the `magicLinkTokens` Drizzle table declaration: `// DEPRECATED Phase 1 (2026-05-04): Better Auth's verification table is the source of truth for magic-link issuance/verification. This table is dead code. Drop in Phase 1.x cleanup migration. Do NOT build new features against it.` DO NOT touch the actual schema — keep all columns intact (RESEARCH §4 LOCKED row). Independent comment-only edit; runs in Wave 0.</action>
  <verify>
    <automated>grep -q 'DEPRECATED Phase 1' src/db/schema.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <done>Comment present; schema unchanged; typecheck clean.</done>
</task>

<!--
WAVE 1 — auth flow (depends on Wave 0: env vars + profile-rules + audit-type union)
Order matters: dal.ts before pages that consume it; auth.ts edit before signup actions.
-->

<task type="auto" tdd="true">
  <name>T-07 (Wave 1): Create src/lib/dal.ts — Data Access Layer with verifySession + role/profile gates</name>
  <files>src/lib/dal.ts, tests/unit/dal.test.ts</files>
  <behavior>
    - verifySession returns null when auth.api.getSession returns null
    - verifySession returns null when domain users row does not exist (orphan Better Auth session)
    - verifySession returns SessionUser with profileComplete=true for role=public/admin (no profile lookup)
    - verifySession returns SessionUser with profileComplete derived from isArtistComplete/isVenueComplete for role=artist/venue
    - verifySession is wrapped in React cache() (call twice within a render → only one DB hit; assert via mock)
    - requireRole redirects to /login when no session
    - requireRole redirects to / when session role not in allowed list
    - requireRole returns SessionUser when session role is in allowed list
    - requireCompleteProfile redirects to /me/edit when profileComplete=false
    - requireCompleteProfile returns SessionUser when profileComplete=true
  </behavior>
  <action>Write tests FIRST (RED) using vi.mock for `auth.api.getSession`, `db.query.users`, `db.query.artistProfiles`, `db.query.venueProfiles`. Then implement per RESEARCH §2.4 skeleton: import 'server-only' at top; export `SessionUser` type; export `verifySession = cache(async () => ...)`; export `requireRole(roles)` and `requireCompleteProfile()` helpers using `redirect()` from next/navigation. Use `isArtistComplete` / `isVenueComplete` from T-04 (already present in Wave 0). CRITICAL — per Next.js 16 docs (RESEARCH §3.1), this file does the authoritative gate; proxy.ts does NOT.</action>
  <verify>
    <automated>pnpm vitest run tests/unit/dal.test.ts</automated>
  </verify>
  <done>10+ test cases pass; `import 'server-only'` at top; React `cache` wraps `verifySession`; helpers exported; `pnpm typecheck` clean.</done>
</task>

<task type="auto">
  <name>T-08 (Wave 1): Modify src/lib/auth.ts — storeToken: 'hashed' + status pre-flight in sendMagicLink</name>
  <files>src/lib/auth.ts, src/lib/email/magic-link.tsx</files>
  <action>Per RESEARCH §2.1 + §3.2: (a) Add `storeToken: 'hashed'` to the existing `magicLink({...})` plugin config (REQ-magic-link-auth: HMAC at rest). (b) Rewrite the existing `sendMagicLink` callback to: query domain users by lowercase email, columns `{status: true}`; if `status === 'email_invalid'` → call `audit({ actorUserId: null, action: 'magic_link.suppressed_invalid_email', target: \`email:${email}\`, meta: { reason: 'users.status=email_invalid' } })` and return WITHOUT sending (Better Auth treats this as success — user sees "check your inbox" without revealing account state). Otherwise call `resend.emails.send` with the new template + audit `magic_link.issued`. (c) Create `src/lib/email/magic-link.tsx` exporting `magicLinkEmail({ url }): string` — DE Sie-Form copy per tone-of-voice §5.7 verbatim ("Hallo, Sie haben sich gerade bei KultA angemeldet. Klicken Sie auf den Link…"). Include `Glück auf.` sign-off (one of the two allowed product-wide instances per §1.7). DO NOT touch `databaseHooks.user.create.after` — Phase 0 already mirrors Better Auth user → domain users with role='public'.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm vitest run tests/integration/better-auth-smoke.test.ts</automated>
  </verify>
  <done>auth.ts has `storeToken: 'hashed'`; sendMagicLink does the status pre-flight + audit; magic-link.tsx exports the DE template; smoke test still passes.</done>
</task>

<task type="auto">
  <name>T-09 (Wave 1): Create proxy.ts at project root (Next.js 16 optimistic gate, NO db queries)</name>
  <files>proxy.ts</files>
  <action>Per RESEARCH §3.1 + AGENTS.md "this is NOT the Next.js you know": create `proxy.ts` at project root (NOT in src/app, NOT named middleware.ts). Implement per RESEARCH §3.1 skeleton verbatim: PUBLIC_PATHS = ['/', '/events', '/login', '/auth/verify', '/auth/post-verify']; PUBLIC_PREFIXES = ['/events/', '/artists/', '/venues/', '/api/auth/', '/api/webhooks/', '/_next/']; PROTECTED_PREFIXES = ['/artist', '/venue', '/admin', '/me']; cookie name `better-auth.session_token` (verify against running app once locally — RESEARCH §7 Q1 flagged as MEDIUM confidence ASSUMED). Treat /artist/signup and /venue/signup as PUBLIC (regex match before PROTECTED check). On protected path with no cookie → 307 redirect to `/login?redirect={pathname}`. NO database calls in this file (Next.js 16 docs explicitly forbid). matcher excludes `_next/static`, `_next/image`, `favicon.ico`. Add JSDoc comment at top: "DO NOT add DB queries here — Next.js 16 prescribes optimistic cookie checks only. Authoritative role + profileComplete gates live in src/lib/dal.ts (requireRole, requireCompleteProfile) called from layouts."</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm build 2>&amp;1 | tee /tmp/build.log; ! grep -iE '(proxy|middleware).*(error|warn)' /tmp/build.log</automated>
  </verify>
  <done>proxy.ts exists at project root; build succeeds; no proxy/middleware errors or warnings; JSDoc warning present.</done>
</task>

<task type="auto">
  <name>T-10 (Wave 1): Create /login Server Component + actions.ts (universal login)</name>
  <files>src/app/(public)/login/page.tsx, src/app/(public)/login/actions.ts</files>
  <action>Per D-1.1 + RESEARCH §3.4: page.tsx renders a single email-input form (Server Component). actions.ts exports `requestMagicLink(formData)` — Server Action that: (a) reads x-forwarded-for from headers; (b) calls `magicLinkLimit.limit(ip)` from src/lib/ratelimit.ts; if !success → return `{ error: 'rate_limit', retryAfter: reset }`; (c) calls `auth.api.signInMagicLink({ body: { email, callbackURL: '/auth/post-verify' } })` (NO role param — universal login; returning user's existing role is preserved per D-1.1); (d) returns `{ ok: true }`. Page UI: DE Sie-Form per tone-of-voice — heading "Anmelden", email input, button "Magic-Link anfordern". On success: show "Wir haben Ihnen eine Mail geschickt. Bitte prüfen Sie Ihren Posteingang." On rate_limit: "Zu viele Versuche. Bitte versuchen Sie es in einer Minute noch einmal." (DE Sie-Form). Use `aria-live="polite"` on status region for a11y. Required: zero WCAG 2.1 AA violations (Phase verification will assert via @axe-core/playwright). NOTE: per W2 mitigation in T-12, /login also accepts `?error=email_invalid` query param — when present, render German banner "Diese E-Mail-Adresse konnte nicht zugestellt werden. Bitte verwenden Sie eine andere Adresse." AND, IF a session cookie is present at request time, call a Server Action that performs `cookies().delete('better-auth.session_token')` to clear the orphaned session.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint src/app/\(public\)/login/</automated>
  </verify>
  <done>Page renders; Server Action wired; rate limit hook in place; copy in DE Sie-Form per tone-of-voice; aria-live region present; ?error=email_invalid handler clears session cookie via Server Action when applicable.</done>
</task>

<task type="auto">
  <name>T-11 (Wave 1): Create /artist/signup landing + actions.ts (D-1.1 role-bearing)</name>
  <files>src/app/(public)/artist/signup/page.tsx, src/app/(public)/artist/signup/actions.ts</files>
  <action>Per D-1.1: artist-targeted landing page with marketing-aware DE Sie-Form copy per tone-of-voice §5.4 manifest framing ("Bestätigt von beiden Seiten" angle). Hero: "Spielen Sie im Ruhrgebiet." Body: brief reasoning + email form. Server Action `requestArtistSignup(formData)`: same rate-limit hook as T-10, but `callbackURL: '/auth/post-verify?role=artist'` (role travels via callbackURL — RESEARCH §2.1 verified pattern, NOT in cryptographic token). Same status messaging on success/rate-limit as T-10. Copy passes anti-tone audit (§2): no "exklusiv", "magisch", no Wohnzimmer-Salon imagery. Use "Künstler:in" with Doppelpunkt (§3.1).</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint src/app/\(public\)/artist/</automated>
  </verify>
  <done>Page renders; callbackURL contains `role=artist`; copy passes tone-of-voice §3.4 (Sie-Form everywhere) and §2 anti-tone.</done>
</task>

<task type="auto">
  <name>T-12 (Wave 1): Create /venue/signup landing + actions.ts (D-1.1 role-bearing)</name>
  <files>src/app/(public)/venue/signup/page.tsx, src/app/(public)/venue/signup/actions.ts</files>
  <action>Per D-1.1: venue-targeted landing with DE Sie-Form copy per tone-of-voice §5.4. Hero: "Öffnen Sie Ihren Raum." Body: 1-paragraph reasoning + email form. Server Action `requestVenueSignup(formData)`: rate-limit + `callbackURL: '/auth/post-verify?role=venue'`. Use "Gastgeber:in" (§3.1) for venues — never "Veranstalter" or "Host". Same status/error treatment as T-10/T-11.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint src/app/\(public\)/venue/</automated>
  </verify>
  <done>Page renders; callbackURL contains `role=venue`; tone-of-voice compliance verified.</done>
</task>

<task type="auto">
  <name>T-13 (Wave 1): Create /auth/verify page (3-state error UX per D-1.4)</name>
  <files>src/app/auth/verify/page.tsx</files>
  <action>Per D-1.4 + RESEARCH §2.1 §5a: this page is the LANDING for verify failures (Better Auth's success path skips it and goes straight to callbackURL = /auth/post-verify). Read `searchParams.error` and `searchParams.token` (Promise per Next.js 16). Disambiguation logic per RESEARCH §2.1: (a) if no `error` param at all → server-side redirect to /login (this page should not be reachable on success); (b) on error, look up the verification row (Better Auth's `verification` table) by tokenHash if token present, to disambiguate `used` (row exists with consumedAt OR ATTEMPTS_EXCEEDED returned) vs `expired` (row exists with past expiresAt and not consumed) vs `invalid` (no row found OR HMAC mismatch). For each branch: (i) write `audit({ actorUserId: null, action: 'magic_link.{replay_attempt|expired|invalid}', target: \`email:${email_hash}\`, meta: { error_code } })`; (ii) render the matching DE Sie-Form copy + CTA per the table in `<interfaces>` block above. Use `aria-live="polite"` for the message; ensure focus management (page-level h1 receives focus on render). Add note to file: hashing email for audit `target` to avoid leaking PII into audit_log target column — use `crypto.createHash('sha256').update(email).digest('hex').slice(0,16)` if the email is reachable.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint src/app/auth/verify/</automated>
  </verify>
  <done>3 distinct states render with their named copy + CTA; all 3 write distinct audit actions; email_hash used for target; a11y attributes in place.</done>
</task>

<task type="auto">
  <name>T-14 (Wave 1): Create /auth/post-verify page (first-verify role write)</name>
  <files>src/app/auth/post-verify/page.tsx</files>
  <action>Per D-1.1 + RESEARCH §2.1 skeleton: Server Component, reads `searchParams.role` (Promise per Next.js 16). Steps: (1) `const session = await auth.api.getSession({ headers: await headers() })`; if !session → `redirect('/login?error=invalid')`. (2) Look up user in domain `users` table by session.user.email. (3) **W2 mitigation — IF `user.status === 'email_invalid'`:** do NOT call `auth.api.signOut` from a Server Component (it requires a Route Handler / Server Action context — won't work inline). Instead: `redirect('/login?error=email_invalid')`. The /login page (T-10) inspects `?error=email_invalid` and, when a session cookie is present at that request, invokes a Server Action that calls `cookies().delete('better-auth.session_token')` to clear the orphaned session. This keeps the cookie-clearing in a context that can mutate cookies. Document this two-step dance with an inline comment in this file. (4) IF `user.role === 'public'` AND `(role === 'artist' || role === 'venue')` → `db.update(users).set({ role }).where(eq(users.id, user.id))` + `audit({ actorUserId: user.id, action: 'user.role_assigned', target: \`user:${user.id}\`, meta: { role, source: 'magic_link_signup' } })`. (5) `redirect('/me')`. CRITICAL invariant: never write `role='admin'` from this page (REQ-roles-rbac SC#4) — explicit type guard `role === 'artist' || role === 'venue'` prevents it.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>page.tsx written per skeleton; admin-write impossibility provable via type guard; email_invalid race delegated to /login via redirect (W2 fix); redirects to /me on success.</done>
</task>

<task type="auto">
  <name>T-15 (Wave 1): Create scripts/provision-admin.ts + add `provision:admin` npm script</name>
  <files>scripts/provision-admin.ts, package.json</files>
  <action>Per RESEARCH §3.6: one-shot script that imports `db`, `users`, `env`. Throws if `env.ADMIN_EMAIL` missing. Performs `INSERT INTO users (email, role, status) VALUES (env.ADMIN_EMAIL, 'admin', 'active') ON CONFLICT (email) DO UPDATE SET role='admin'`. Logs "Provisioned admin: $EMAIL". Add `package.json` script: `"provision:admin": "tsx scripts/provision-admin.ts"`. (Phase 0 likely already has tsx as dev dep — verify; if not, also add `pnpm add -D tsx` here.) The admin then logs in via the universal `/login` path — no separate `/admin/signup` exists (REQ-roles-rbac SC#4). Add a runbook entry (T-23 covers full runbook update).</action>
  <verify>
    <automated>pnpm typecheck scripts/provision-admin.ts</automated>
  </verify>
  <done>Script type-checks; package.json script exists; ADMIN_EMAIL absence causes early throw with clear message.</done>
</task>

<!--
WAVE 2 — profiles + uploads + public views (depends on Wave 1: dal.ts, auth, role-bearing flows)
-->

<task type="auto">
  <name>T-16 (Wave 2): Create /me page (authenticated home for any role)</name>
  <files>src/app/me/page.tsx</files>
  <action>Server Component. Calls `verifySession()` from src/lib/dal.ts; if null → `redirect('/login')`. Renders simple "Hallo {email}" heading + role-aware navigation (artist sees link to /artist; venue sees /venue; admin sees /admin) + "Profil bearbeiten" link to /me/edit + "Abmelden" sign-out form. If `!profileComplete` → render banner with link to /me/edit (banner is non-blocking here — /me itself is allowed even with incomplete profile per D-1.3). DE Sie-Form copy throughout.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>page.tsx written; role-aware nav present; banner shown when profileComplete=false.</done>
</task>

<task type="auto">
  <name>T-17 (Wave 2): Create /api/profile/upload route (Vercel Blob handleUpload with auth + count + size + type gates)</name>
  <files>src/app/api/profile/upload/route.ts</files>
  <action>Per D-1.2 + RESEARCH §2.2 skeleton: route exports `POST(request: Request)`. Inside: `const body = (await request.json()) as HandleUploadBody`. Call `handleUpload({ body, request, onBeforeGenerateToken, onUploadCompleted })`. `onBeforeGenerateToken`: (a) `auth.api.getSession({ headers: await headers() })` → if null throw new Error('Not authenticated') (returns 401). (b) Look up domain user; if role !== 'artist' && role !== 'venue' throw 'Forbidden' (returns 403). (c) Read existing portfolioBlobs.length (artist) or photoBlobs.length (venue); if `>= LIMITS[role]` (artist: 10, venue: 8) throw `Upload limit reached`. (d) Return `{ allowedContentTypes: ['image/jpeg','image/png','image/webp'], maximumSizeInBytes: 5*1024*1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ userId: user.id, role: user.role }) }`. `onUploadCompleted`: parse tokenPayload (Zod parse for safety per RESEARCH §6); UPDATE the JSONB column with `||` append per RESEARCH §3.3 SQL escape hatch. Race on count — accepted gap per RESEARCH §5f (max 12 files in pathological case; document in test). Return `NextResponse.json(result)` from happy path; on error throw → 400 in catch branch with `{ error: message }`.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>Route compiles; all 4 gates (auth, role, count, content-type+size) implemented; JSONB append uses Drizzle sql template; race-on-count documented in JSDoc.</done>
</task>

<task type="auto">
  <name>T-18 (Wave 2): Create /me/edit page + actions.ts (artist + venue branched profile editor)</name>
  <files>src/app/me/edit/page.tsx, src/app/me/edit/actions.ts</files>
  <action>Server Component. Calls `verifySession()`; if null → /login; if role==='public' → /me with "Bitte schließen Sie zuerst die Anmeldung ab" toast (defensive — should not happen per D-1.1 flow, but guard). Branched UI: if role==='artist' → render artist form (displayName, bio, optional Instagram handle, optional website URL) + portfolio uploader (T-19 component). If role==='venue' → venue form (name, addressStreet, addressCity, addressZip, capacity int, optional lat/lon for now) + photos uploader (T-20). Server Action `saveProfile(formData)`: Zod-validate per role → UPSERT artist_profiles or venue_profiles → recompute `isArtistComplete`/`isVenueComplete`; if newly complete (was false, now true) → audit `user.profile_completed`; otherwise audit `user.profile_updated` → return `{ ok: true, justCompleted: <bool> }`. UI shows DE Sie-Form labels + helper text; on `justCompleted` show one-time green toast "Profil vollständig — Sie können jetzt Vorhaben veröffentlichen" (storage strategy per RESEARCH §7 Q6 — choose `localStorage` flag `profile-completed-toast-seen=1` to avoid migration; document choice in code comment). All inputs use `aria-describedby` for helper/error text; error states via `aria-invalid` + `aria-live="polite"` region.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint src/app/me/edit/</automated>
  </verify>
  <done>page.tsx + actions.ts compile; both role branches implemented; audit calls present; one-time toast strategy documented.</done>
</task>

<task type="auto">
  <name>T-19 (Wave 2): Create /me/edit/portfolio-uploader.tsx (artist client-side parallel upload)</name>
  <files>src/app/me/edit/portfolio-uploader.tsx</files>
  <action>Per RESEARCH §2.2 + D-1.2: `'use client'` component. File input accepts `image/jpeg,image/png,image/webp`, multiple. On change: client-side preview-only check (count + size + type) — never trusted, server is authoritative. Iterate via `Promise.allSettled(files.map(f => upload(f.name, f, { access: 'public', handleUploadUrl: '/api/profile/upload' })))`. Per-file progress (the `upload` SDK accepts `onUploadProgress` — wire it to a state map). On rejection per file, surface friendly DE error: "Datei {n}: {de_message}" (translate well-known error strings: "Upload limit reached" → "Upload-Limit erreicht (10 Dateien)"; "Forbidden" → "Nicht berechtigt"; "Not authenticated" → "Bitte melden Sie sich erneut an"). On full batch success → `router.refresh()` so the server re-renders with new portfolioBlobs. Tone-of-voice §3.4 Sie-Form for all visible copy.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>Component compiles; parallel upload pattern via Promise.allSettled; per-file progress wired; DE error mapping covers the 3 server-side error strings.</done>
</task>

<task type="auto">
  <name>T-20 (Wave 2): Create /me/edit/photos-uploader.tsx (venue client-side parallel upload)</name>
  <files>src/app/me/edit/photos-uploader.tsx</files>
  <action>Identical pattern to T-19, but limit messaging adjusted to 8 files ("Upload-Limit erreicht (8 Dateien)"). Posts to same `/api/profile/upload` endpoint — server route discriminates artist/venue from session role, not request payload. Re-uses the same DE error mapping. Tone-of-voice compliance.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>Component compiles; 8-file messaging in place; reuses same upload endpoint contract.</done>
</task>

<task type="auto">
  <name>T-21 (Wave 2): Create /artist /venue /admin layouts + stub pages (gated by DAL)</name>
  <files>src/app/artist/layout.tsx, src/app/artist/page.tsx, src/app/venue/layout.tsx, src/app/venue/page.tsx, src/app/admin/layout.tsx, src/app/admin/page.tsx</files>
  <action>Per RESEARCH §2.4 + REQ-roles-rbac SC#3: each layout calls `await requireRole(['artist'])` (or 'venue', or 'admin') from src/lib/dal.ts FIRST, then `await requireCompleteProfile()` for artist/venue (NOT admin — admin doesn't have artist_profiles or venue_profiles). Stub pages render `<h1>Bereich für Künstler:innen</h1>` (artist) / `<h1>Bereich für Gastgeber:innen</h1>` (venue) / `<h1>Admin-Bereich</h1>` (admin) plus a "Phase 2 wires the actual content" placeholder paragraph. Tone-of-voice DE Sie-Form. The point of these stubs is to let role-gate verification (T-26) assert 200 vs 403 vs redirect-to-/me/edit cleanly.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm build</automated>
  </verify>
  <done>3 layouts + 3 stub pages compile; build succeeds; layouts call DAL helpers.</done>
</task>

<task type="auto">
  <name>T-22 (Wave 2): Create /artists/[slug] and /venues/[slug] public profile views</name>
  <files>src/app/artists/[slug]/page.tsx, src/app/venues/[slug]/page.tsx</files>
  <action>Per REQ-profile-uploads + ROADMAP SC#5/6: public anonymous Server Components. For `/artists/[slug]`: look up `artist_profiles` joined with `users` where slug matches users.id (slug semantics for v1 = userId; if a real slug field is desired later, that's a Phase 1.x add). If not found → notFound(). Render: displayName as h1, bio as paragraph, optional Instagram + website links (rel="noopener"), portfolioBlobs as `<img>` grid with alt text from each blob's `alt` field. For `/venues/[slug]`: similar but render name, address, capacity, photoBlobs grid. Both pages: leverage Cache Components (Phase 0 enabled `cacheComponents`) for p95 < 2s. `<img>` tags use `next/image` for built-in lazy loading. Zero WCAG 2.1 AA violations target — verify in Wave 4.</action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm build</automated>
  </verify>
  <done>Both pages compile; build succeeds; alt text wired; next/image used.</done>
</task>

<!--
WAVE 3 — bounce webhook + audit hardening (depends on Wave 0 env + Wave 1 auth.ts pre-flight)
-->

<task type="auto">
  <name>T-23 (Wave 3): Create /api/webhooks/resend/bounce route (svix-verified, hard-bounce only)</name>
  <files>src/app/api/webhooks/resend/bounce/route.ts</files>
  <action>Per RESEARCH §2.3 skeleton: `POST(req: Request)`. (1) `const rawBody = await req.text()` — NOT json() (svix needs raw body for HMAC). (2) **B4 fix — name the local headers map `svixHeaders` to disambiguate from Next.js `headers()` import:** `const svixHeaders = { 'svix-id': req.headers.get('svix-id') ?? '', 'svix-timestamp': req.headers.get('svix-timestamp') ?? '', 'svix-signature': req.headers.get('svix-signature') ?? '' }`. (3) `new Webhook(env.RESEND_WEBHOOK_SECRET).verify(rawBody, svixHeaders)` — on throw → return 401 'Invalid signature'. (4) If `event.type !== 'email.bounced'` → return 200 'Ignored'. (5) Per RESEARCH §7 Q3 + Assumption A4 (MEDIUM confidence): only flip status for HARD bounces. Check `event.data.bounce?.type === 'hard'`; soft bounces → 200 OK with no DB write. (6) `db.update(users).set({ status: 'email_invalid' }).where(eq(users.email, email.toLowerCase()))` — idempotent. (7) `audit({ actorUserId: null, action: 'user.email_invalid', target: \`email:${emailHash}\`, meta: { source: 'resend.bounce', svixId: svixHeaders['svix-id'], bounceType: 'hard' } })`. (8) Return 200 'OK'. NOTE: this route MUST be in PUBLIC_PREFIXES of proxy.ts (`/api/webhooks/`) — already covered in T-09.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>Route compiles; hard-bounce-only logic in place; raw body used; PII-hashed target in audit_log; local headers map named `svixHeaders` (not shadowing Next.js `headers`).</done>
</task>

<task type="auto">
  <name>T-24 (Wave 3): Update docs/runbook.md with Phase 1 ENV + bounce webhook setup + admin provisioning</name>
  <files>docs/runbook.md</files>
  <action>Append a "Phase 1 — Auth & Profiles" section to the existing Phase 0 runbook. Cover: (1) ENV var inventory delta — `RESEND_WEBHOOK_SECRET=whsec_…` (Vercel ENV all 3 environments), `ADMIN_EMAIL=…` (Vercel ENV; optional in dev). (2) Resend dashboard webhook setup: Dashboard → Webhooks → Create endpoint → URL `https://<deployment>/api/webhooks/resend/bounce` → Subscribe `email.bounced` → copy `whsec_…` secret → set as Vercel ENV `RESEND_WEBHOOK_SECRET` in Dev/Preview/Prod. (3) Order of operations on first deploy: (a) set RESEND_WEBHOOK_SECRET in Vercel ENV FIRST; (b) deploy code; (c) configure Resend dashboard endpoint; (d) test via Resend's "Send test event" button — should see 200 OK in webhook logs. (4) Admin provisioning: `pnpm provision:admin` (one-shot per env). Repeatable — UPSERT semantics. (5) Better Auth schema-drift check: any `pnpm add better-auth@<new-version>` requires re-running `npx @better-auth/cli generate` and updating both `drizzle/0001_better_auth.sql` AND `src/db/auth-schema.ts`; CI will block PRs that drift.</action>
  <verify>
    <automated>grep -q 'Phase 1' docs/runbook.md &amp;&amp; grep -q 'RESEND_WEBHOOK_SECRET' docs/runbook.md &amp;&amp; grep -q 'provision:admin' docs/runbook.md</automated>
  </verify>
  <done>All 5 sections present in runbook; ordering documented; admin provision command documented.</done>
</task>

<!--
WAVE 4 — verification (depends on all prior waves; tests can run in parallel within this wave)
-->

<task type="auto">
  <name>T-25 (Wave 4): Test infrastructure scaffolding — mock-resend, mock-ratelimit, magic-link-helpers, svix-helpers</name>
  <files>tests/setup/mock-resend.ts, tests/setup/mock-ratelimit.ts, tests/integration/magic-link-helpers.ts, tests/integration/svix-helpers.ts</files>
  <action>Per RESEARCH §6 "Wave 0 gaps" + B1 mitigation. (1) `tests/setup/mock-resend.ts`: vitest setup file that uses `vi.mock` to replace `resend.emails.send` with a stub that pushes to an in-memory `sentEmails: Array<{ to, subject, html }>` array; export accessors `getLastEmail()`, `clearSentEmails()`. (2) **B1 — `tests/setup/mock-ratelimit.ts`:** vitest setup that uses `vi.mock('@upstash/ratelimit', ...)` to replace the Ratelimit class with an in-memory counter implementation: keeps a `Map<string, { count: number, resetAt: number }>`; `.limit(key)` increments count if `now < resetAt` else resets count=1; returns `{ success: count <= 10, reset: resetAt, remaining: max(0, 10-count), limit: 10 }`. Window = 60s. Export `resetRatelimitMocks()` for test isolation. (3) `tests/integration/magic-link-helpers.ts`: utility `getLatestMagicLinkUrl(email)` that queries the testcontainers Postgres `verification` table (Better Auth's table) for the most recent row matching the email and reconstructs the URL from the token. (4) `tests/integration/svix-helpers.ts`: utility `signSvixPayload(payload: object, secret: string): { rawBody: string, headers: { 'svix-id', 'svix-timestamp', 'svix-signature' } }` using the `svix` package's signing API. Used by T-27's bounce-webhook test.</action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>4 utility files compile; export expected APIs; mock-ratelimit returns the exact shape Upstash returns (success/reset/remaining/limit).</done>
</task>

<task type="auto">
  <name>T-26 (Wave 4): Integration tests — magic-link 3-state + post-verify role gating + upload + bounce + rate-limit (SC#2)</name>
  <files>tests/integration/magic-link.test.ts, tests/integration/post-verify.test.ts, tests/integration/upload.test.ts, tests/integration/bounce-webhook.test.ts, tests/integration/rate-limit.test.ts</files>
  <action>Use Phase 0's testcontainers Postgres setup. Cover the 5 critical integration paths against a real DB. (a) `magic-link.test.ts`: happy-path issue→verify→session; replay returns "used" branch + audit `magic_link.replay_attempt`; expired (manipulate verification.expiresAt to past) returns "expired" branch + audit `magic_link.expired`; bogus token returns "invalid" branch + audit `magic_link.invalid` (RESEARCH §5a — the audit-precision watch-out). (b) `post-verify.test.ts`: 4 scenarios — first-verify with role=artist writes user.role='artist' + audit `user.role_assigned`; existing artist user calling post-verify?role=venue does NOT change role (security per RESEARCH §5g); post-verify?role=admin is impossible (type-guard prevents); user with status='email_invalid' is redirected to `/login?error=email_invalid` (per W2 fix in T-14). **W4 fix — add explicit assertion at the start of the happy-path test: after Better Auth's first verify call completes, query domain `users` table for the email and `expect(domainUser).toBeDefined()` BEFORE invoking /auth/post-verify; this validates Assumption A7 about `databaseHooks.user.create.after` ordering.** (c) `upload.test.ts`: unauthenticated POST → 401; non-artist/venue role → 403; 11th upload as artist → 400 'Upload limit reached'; valid upload appends to portfolioBlobs JSONB. (d) `bounce-webhook.test.ts`: invalid svix signature → 401; valid signature with email.bounced + bounce.type='hard' → users.status='email_invalid' + audit `user.email_invalid`; soft bounce → 200 + no status flip; subsequent magic-link request to email_invalid address triggers `magic_link.suppressed_invalid_email` audit + no Resend.send call (mocked). (e) **B1 — `rate-limit.test.ts`:** import the mock-ratelimit setup from T-25. Test scenario: in a single `describe`, fire 11 sequential calls to the `/login` Server Action `requestMagicLink` from the same simulated IP (use a Request mock with `x-forwarded-for: '203.0.113.42'`); assert calls 1-10 return `{ ok: true }`; assert call 11 returns `{ error: 'rate_limit', retryAfter: <number> }` AND that the response status code carried up is 429 with `Retry-After: <seconds>` header. Also assert: a 12th call from a DIFFERENT IP succeeds (per-IP isolation). Use `resetRatelimitMocks()` in `afterEach` for isolation.</action>
  <verify>
    <automated>pnpm vitest run tests/integration/magic-link.test.ts tests/integration/post-verify.test.ts tests/integration/upload.test.ts tests/integration/bounce-webhook.test.ts tests/integration/rate-limit.test.ts</automated>
  </verify>
  <done>All 5 test files green; testcontainers spins up; assertions cover happy path + each error branch + audit precision + 11th-request 429 with locked body shape and Retry-After header + per-IP isolation; W4 domainUser assertion present in post-verify happy path.</done>
</task>

<task type="auto">
  <name>T-27 (Wave 4): E2E tests — auth-flow, role-gates, magic-link-error-states, profile-upload</name>
  <files>tests/e2e/auth-flow.spec.ts, tests/e2e/route-gates.spec.ts, tests/e2e/magic-link-error-states.spec.ts, tests/e2e/profile-upload.spec.ts</files>
  <action>Playwright e2e against a running preview build. Mock Resend via env override (use the mock-resend setup file in test mode + a way to fetch the magic-link URL the test harness — likely via the verification table query helper from T-25). (a) `auth-flow.spec.ts`: full happy path — visit /artist/signup, submit email, fetch magic-link URL from DB, click it, land at /me, click "Profil bearbeiten", fill displayName + bio (≥10 chars), upload 1 image, navigate to /artist → assert 200. (b) `route-gates.spec.ts`: parameterized matrix from ROADMAP SC#3 — for each (role ∈ {anon, artist, venue, admin}) × (path ∈ {/, /events, /events/x, /artists/y, /venues/z, /login, /artist/signup, /venue/signup, /artist, /venue, /admin, /me}) → assert expected 200/redirect/401-ish. Anon must get 200 on the public list; artist must get redirect to /login on /admin; etc. (c) `magic-link-error-states.spec.ts`: visit /auth/verify with manipulated query strings → assert each of the 3 DE copy strings appears + correct CTA target href. (d) `profile-upload.spec.ts`: artist signs in, uploads 10 images sequentially → all succeed; 11th → "Upload-Limit erreicht (10 Dateien)" surfaces in UI; image of `image/svg+xml` content-type rejected client-side AND server-side. Run @axe-core/playwright on /login + /artist/signup + /venue/signup + /me/edit + /auth/verify (all 3 states) → assert zero WCAG 2.1 AA violations.</action>
  <verify>
    <automated>pnpm test:e2e tests/e2e/auth-flow.spec.ts tests/e2e/route-gates.spec.ts tests/e2e/magic-link-error-states.spec.ts tests/e2e/profile-upload.spec.ts</automated>
  </verify>
  <done>All 4 e2e specs green; axe checks pass; route matrix asserts all 12 cells.</done>
</task>

<task type="auto">
  <name>T-28 (Wave 4): Lighthouse mobile ≥ 90 on /login, /artist/signup, /venue/signup</name>
  <files>.github/workflows/lighthouse.yml</files>
  <action>Phase 0 already wired Lighthouse on `/`. Extend the existing `.github/workflows/lighthouse.yml` (or a config file it consumes) to additionally run against `/login`, `/artist/signup`, `/venue/signup`. Threshold: mobile performance ≥ 0.9; accessibility = 1.0. CI fails if any URL drops below threshold. NOTE: skip the routes that require login (Lighthouse-mobile cannot easily auth; /me/edit etc. are deferred). REQ-quality-bar SC binds for these public routes.</action>
  <verify>
    <automated>grep -E '/login|/artist/signup|/venue/signup' .github/workflows/lighthouse.yml | wc -l | grep -qE '^[3-9]|[1-9][0-9]+$'</automated>
  </verify>
  <done>Workflow includes 3 new public-route checks; threshold mobile ≥ 0.9 enforced.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /api/auth/*  | Untrusted email + magic-link click crosses here. Better Auth validates HMAC, single-use, expiry. Rate-limited 10/min/IP. |
| Browser → /api/profile/upload | Untrusted file metadata crosses here. Server validates session, role, count, content-type whitelist, size cap BEFORE issuing signed token. |
| Browser → Vercel Blob (direct) | Once a signed token is issued, file bytes go browser→edge directly. Signed token enforces content-type + size. |
| Email link click → /auth/post-verify | After Better Auth verifies session, role param in URL is ATTACKER-CONTROLLED. Server-side check: only writes role if current role==='public'. |
| Resend → /api/webhooks/resend/bounce | External webhook; svix HMAC signature verified against raw body before any DB action. |
| Better Auth verification table → /auth/verify error UX | Read-only disambiguation; precision matters for audit (replay vs expired vs invalid). |
| Server Action requestMagicLink → Better Auth | Rate-limit hook gates this boundary by IP; bypass attempts surface as 429. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | /auth/post-verify | mitigate | Role written only when `current users.role==='public'`; existing-user role param ignored (RESEARCH §5g). Integration test T-26(b) asserts venue user calling post-verify?role=artist does NOT mutate role. |
| T-01-02 | Spoofing | /api/webhooks/resend/bounce | mitigate | svix HMAC-SHA256 verification against raw `request.text()` body using `RESEND_WEBHOOK_SECRET`; invalid signature → 401 + no DB write (RESEARCH §2.3). Integration test T-26(d) asserts bogus signature is rejected. |
| T-01-03 | Tampering | Magic-link token | mitigate | Better Auth `storeToken: 'hashed'` stores HMAC at rest (REQ-magic-link-auth); 15-min TTL; single-use (allowedAttempts: 1). Tampered token fails HMAC re-verify → "invalid" branch in T-13 + audit `magic_link.invalid`. |
| T-01-04 | Tampering | /api/profile/upload tokenPayload | mitigate | tokenPayload is signed by Vercel Blob; on `onUploadCompleted` we Zod-parse it before trusting `userId`/`role`. JSON.parse without validation would let Vercel Blob's signed payload still come from us — Zod parse is defense-in-depth. |
| T-01-05 | Repudiation | All auth state changes | mitigate | Every magic-link issue/replay/expire/invalid + role assign + bounce flip writes to `audit_log` via Phase 0 `audit()` helper with appropriate actor + meta. T-26 asserts each action enum reaches DB. |
| T-01-06 | Information Disclosure | Magic-link enumeration | mitigate | sendMagicLink for `users.status='email_invalid'` returns success without sending (RESEARCH §2.1) — same UX as valid email; attacker cannot distinguish valid/invalid emails by response shape. Auto-resend on expired explicitly NOT chosen (D-1.4). 10/min/IP rate limit further bounds enumeration speed. |
| T-01-07 | Information Disclosure | audit_log target column PII | mitigate | Email address never stored verbatim in `audit_log.target` — instead use SHA-256-truncated hash for non-actor-resolved entries (e.g. magic_link.invalid before user is known). T-13 + T-23 implement this. |
| T-01-08 | Information Disclosure | /api/profile/upload error messages | accept | Errors return human-readable strings ("Upload limit reached") which a malicious user could enumerate to learn LIMITS. Acceptable: limits are documented user-facing constraints (D-1.2), not secrets. |
| T-01-09 | Denial of Service | Magic-link issuance | mitigate | `magicLinkLimit` (10/min sliding window via Upstash) hooked in /login, /artist/signup, /venue/signup Server Actions (RESEARCH §3.4). **Tested via T-26(e):** integration test `tests/integration/rate-limit.test.ts` uses an in-memory Upstash mock (`tests/setup/mock-ratelimit.ts`) to fire 11 sequential calls from the same IP; asserts 11th returns 429 with `{ error: 'rate_limit', retryAfter: <seconds> }` body and `Retry-After` header; 12th call from different IP succeeds (per-IP isolation). REQ-magic-link-auth SC#2 binds. |
| T-01-10 | Denial of Service | /api/profile/upload spam | accept (low risk) | Per-user count cap (10/8) bounds storage cost. No rate limit on token issuance — accepted gap per RESEARCH §2.2 (low risk; only authenticated users hit it). Phase 7 admin moderation can revisit if abuse appears. |
| T-01-11 | Elevation of Privilege | Role escalation via signup | mitigate | Type guard `role === 'artist' || role === 'venue'` in /auth/post-verify; admin literally never reachable from query param. REQ-roles-rbac SC#4: admin via ENV-driven script only. T-26(b) asserts admin literal cannot be set. |
| T-01-12 | Elevation of Privilege | Role escalation across roles | mitigate | First-verify gate `current role==='public'` prevents an existing artist from becoming venue (or vice versa) via re-signup. Same integration test T-26(b). |
| T-01-13 | Elevation of Privilege | Bypass profileComplete gate | mitigate | Layout-level call to `requireCompleteProfile()` runs before any /artist/* or /venue/* page renders (NOT in proxy — Next.js 16 forbids DB in proxy per RESEARCH §3.1). Direct URL navigation cannot bypass; the layout server-side redirect happens before HTML response. |
| T-01-14 | Elevation of Privilege | Signed Blob URL leakage | mitigate | Token TTL 1h (Vercel Blob default); content-type + size enforced by Vercel Blob during upload (not just client-side); even leaked, attacker can only upload one file matching constraints. tokenPayload Zod-validated server-side on completion. |
| T-01-15 | Elevation of Privilege | Better Auth schema drift | mitigate | T-02 adds CI job `better-auth-schema-drift` that diffs `npx @better-auth/cli generate` output against `drizzle/0001_better_auth.sql`. Pinned `better-auth: 1.6.9`. PR with version bump that drifts schema fails CI before merge (RESEARCH §5d). |
| T-01-16 | Information Disclosure | Bounce-then-click race | mitigate | /auth/post-verify checks `users.status==='email_invalid'` post-session-establishment; if true, redirects to `/login?error=email_invalid` (W2 fix); /login then clears the orphaned cookie via Server Action `cookies().delete('better-auth.session_token')`. RESEARCH §5c risk-c. Pre-creation race accepted (Phase 6 domain verification reduces bounce frequency). |
| T-01-17 | Tampering | magic_link_tokens dead-code reuse | mitigate | T-06 adds DEPRECATED comment in src/db/schema.ts warning future contributors not to build against the dead table. Drop migration deferred to Phase 1.x. |
</threat_model>

<verification>

## Phase Requirement Coverage Matrix

| Requirement ID | Acceptance Criterion | Tasks |
|----------------|---------------------|-------|
| REQ-roles-rbac | 4 roles (public, artist, venue, admin) on `users.role` enum | (Phase 0 already created enum; not re-touched) |
| REQ-roles-rbac | Single ENV-provisioned admin (no signup path produces admin) | T-14 (type guard), T-15 (provision script), T-26(b) integration test |
| REQ-roles-rbac | Role-gated routes /artist/*, /venue/*, /admin/* + /me any-auth | T-09 (proxy optimistic), T-21 (layouts call requireRole), T-27 (e2e route-gates matrix) |
| REQ-roles-rbac | Public anonymous can read /, /events, /events/[slug], /artists/[slug], /venues/[slug], /login, /auth/verify | T-09 PUBLIC_PREFIXES, T-22 public profile views, T-10 /login, T-13 /auth/verify, T-27 (e2e public matrix) |
| REQ-magic-link-auth | POST /api/auth/magic-link rate-limited 10/min/IP | T-10/T-11/T-12 Server Actions hook magicLinkLimit (Phase 0 wired); **T-26(e) integration test asserts 11th request returns 429 with locked body shape and Retry-After header** |
| REQ-magic-link-auth | tokenHash HMAC at rest, not plaintext | T-08 sets `storeToken: 'hashed'` |
| REQ-magic-link-auth | expiresAt = now + 15min | T-08 (config already has expiresIn 60*15 from Phase 0; T-08 adds storeToken) |
| REQ-magic-link-auth | Token invalidated post-use; replay rejected | Better Auth `allowedAttempts: 1` (default); T-13 disambiguates "used" branch; T-26(a) replay test |
| REQ-magic-link-auth | /auth/verify consumes token + establishes session | Better Auth route handler (Phase 0 wired) + T-14 post-verify role write + T-13 error landing |
| REQ-magic-link-auth | Email-bounce webhook sets users.status='email_invalid' + blocks further sends | T-23 webhook + T-08 sendMagicLink pre-flight; T-26(d) integration test |
| REQ-profile-uploads | Artist portfolioBlobs jsonb [{url, alt, order}] | T-17 onUploadCompleted JSONB append; schema unchanged |
| REQ-profile-uploads | Venue photoBlobs jsonb [{url, alt}] | T-17 same; schema unchanged |
| REQ-profile-uploads | Signed-URL TTL on upload | Vercel Blob default 1h `validUntil` (T-17); RESEARCH §5b |
| REQ-profile-uploads | Per-user file count limit | T-17 onBeforeGenerateToken count gate; T-26(c) integration test; T-19/T-20 client-side preview |

## Phase-Level Verification

- `pnpm test` (typecheck + lint + vitest) green
- `pnpm test:e2e` green including @axe-core/playwright assertions
- Lighthouse mobile ≥ 0.9 on /, /login, /artist/signup, /venue/signup (T-28 + Phase 0 baseline)
- All 4 required CI checks pass (typecheck, lint, vitest, secret-scan) PLUS new `better-auth-schema-drift` job
- Manual smoke test on preview deploy:
  1. Submit email at /artist/signup → email arrives → click → /me → /me/edit → fill profile → upload 2 images → /artist returns 200
  2. Same magic link clicked again → "Link bereits verwendet" copy + Zum Login CTA visible
  3. /admin without auth → 307 → /login
  4. Resend dashboard → "Send test event" with email.bounced.hard for the test user → users.status='email_invalid' verified via DB query → next /login attempt for that email shows "check inbox" but no Resend send happens (verified in Vercel function logs)

</verification>

<success_criteria>

Phase 1 is COMPLETE when all 7 ROADMAP success criteria pass:

1. **SC#1 — magic-link happy path + replay** — T-26(a) integration + T-27 auth-flow e2e + manual smoke step 1+2
2. **SC#2 — 429 after 11th request/min/IP** — T-10/T-11/T-12 wire `magicLinkLimit`; **T-26(e) integration test asserts the 11th sequential same-IP request returns 429 with body `{ error: 'rate_limit', retryAfter: <seconds> }` and header `Retry-After: <seconds>`, and 12th from different IP succeeds (per-IP isolation)**
3. **SC#3 — role gate matrix (anon/artist/venue/admin × public/protected paths)** — T-09 + T-21 + T-22 + T-27 e2e route-gates
4. **SC#4 — exactly one admin via ENV** — T-14 (type guard) + T-15 (provision script) + T-26(b) impossibility test
5. **SC#5 — artist completes profile + uploads up to 10 portfolio images, renders public** — T-18 + T-19 + T-22 + T-27 profile-upload e2e
6. **SC#6 — venue completes profile + uploads photos, renders public** — T-18 + T-20 + T-22 + T-27
7. **SC#7 — Resend bounce flips users.status + blocks subsequent sends** — T-23 + T-08 + T-26(d) + manual smoke step 4

</success_criteria>

<open_questions>

Questions surfaced by RESEARCH that the executor must resolve in-flight (none block planning):

1. **Better Auth session cookie name** — RESEARCH §7 Q1 ASSUMED `better-auth.session_token`. T-09 executor: log into a dev instance once, inspect `document.cookie`, update proxy.ts cookie name if different.
2. **Better Auth error code enumeration** — RESEARCH §7 Q2 + Assumption A1. T-13 executor: trigger each error scenario in a test env once and capture the actual `?error=` query-param values; update disambiguation logic if it differs from `ATTEMPTS_EXCEEDED`-only.
3. **Resend bounce.type discriminator** — RESEARCH §7 Q3 + Assumption A4. T-23 executor: send a real bounce via Resend test mode and log the full payload structure; if `bounce.type === 'hard'` is wrong, adjust the discriminator (potentially `bounce.subType` or `event.data.bounce_type`).
4. **`/me/edit` one-time toast storage** — RESEARCH §7 Q6. T-18 PLANNED: localStorage flag `kulta-profile-completed-toast-seen=1`. Executor: confirm storage works in iOS Safari Private Mode (graceful no-op acceptable).
5. **Profile slug semantics for /artists/[slug] and /venues/[slug]** — T-22 PLANNED: slug = userId (UUID) for v1. Executor: if a human-readable slug is desired (e.g. `displayName-slug`), that's a Phase 1.x add (requires unique index migration).

</open_questions>

<known_limitations>

Carried into Phase 2+:

1. **Resend From-address is `onboarding@resend.dev`** until Phase 6 verified-domain task. Magic-link emails work but appear from generic sender (Phase 0 SUMMARY known limitation).
2. **`magic_link_tokens` table is dead code** — kept in schema with DEPRECATED comment (T-06); Phase 1.x cleanup migration drops it (RESEARCH §5h).
3. **Race on file-count cap** — two parallel token requests for slots 10+11 may both pass `count=9` check; max 12 files in pathological case. Cost-cap remains within tolerance (RESEARCH §5f). Not a security issue.
4. **Bounce-arrives-before-user-row race** — if a bounce lands before Better Auth's first-verify creates the domain user row, the bounce webhook UPDATE matches 0 rows; user gets created with status='active' on first verify. Phase 6 domain verification makes this near-impossible (RESEARCH §5c-rare).
5. **`/me/edit` localStorage profile-toast** does not survive cross-device or private-window scenarios — acceptable (one-time toast, not a security or UX-critical signal).
6. **`/artists/[slug]` + `/venues/[slug]` slug = userId** for v1 — human-readable slugs deferred.
7. **iOS Safari Private Mode** — localStorage may be unavailable; the toast simply no-ops (graceful). Documented in T-18.
8. **Rate-limit on `/api/profile/upload` token issuance** — not gated; per-user count cap bounds abuse to LIMITS[role] files per user (RESEARCH §5f, §2.2).

</known_limitations>

<output>
After completion, create `.planning/phases/01-auth-profiles/01-01-SUMMARY.md` documenting:
- All 28 tasks completed (or list partial state)
- Phase 1 success criteria verification table (7/7), including SC#2 rate-limit 429 evidence
- Final ENV var inventory (RESEND_WEBHOOK_SECRET, ADMIN_EMAIL added)
- Audit action enum extension (9 new literals)
- Files created (~25) + extended (9), per RESEARCH §4
- Open questions resolved during execution (cookie name, error codes, bounce discriminator)
- Phase 2 handoff: identity layer ready; every authenticated request has a known role; profile completion enforced; bounce handling live
</output>
