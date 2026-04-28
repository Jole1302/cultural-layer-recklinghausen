---
phase: 00-skeleton-infra
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Wave 0 — Bootstrap
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - eslint.config.mjs
  - .prettierrc.json
  - .prettierignore
  - .gitignore
  - .env.example
  - vitest.config.ts
  - playwright.config.ts
  - lighthouserc.json
  - drizzle.config.ts
  - .husky/pre-commit
  - .gitleaks.toml
  - .github/workflows/ci.yml
  - .github/workflows/e2e.yml
  - .github/workflows/lighthouse.yml
  - tests/setup/pg-container.ts
  - tests/e2e/fixtures.ts
  - tests/unit/audit.test.ts
  - tests/e2e/landing.spec.ts
  # Wave 1 — Schema + Audit + Landing
  - src/lib/env.ts
  - src/db/schema.ts
  - src/db/index.ts
  - src/lib/audit.ts
  - src/lib/ratelimit.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/globals.css
  - src/components/cookie-banner.tsx
  - drizzle/0000_initial.sql
  - drizzle/meta/_journal.json
  # Wave 2 — Production wiring
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/db/auth-schema.ts
  - src/app/api/auth/[...all]/route.ts
  - tests/integration/better-auth-smoke.test.ts
  - src/app/api/_test-sentry/route.ts
  - sentry.client.config.ts
  - sentry.server.config.ts
  - sentry.edge.config.ts
  - instrumentation.ts
  - next.config.ts
  - vercel.json
  - docs/runbook.md
autonomous: false   # Phase contains Vercel CLI / Vercel UI / Sentry org / GitHub branch-protection checkpoints
requirements:
  - REQ-quality-bar
  - REQ-audit-log
user_setup:
  - service: vercel
    why: "Hosting + Marketplace integrations (Neon, Blob); ENV management"
    env_vars:
      - name: VERCEL_ORG_ID
        source: "vercel link auto-populates .vercel/project.json"
      - name: VERCEL_PROJECT_ID
        source: "vercel link auto-populates .vercel/project.json"
      - name: VERCEL_AUTOMATION_BYPASS_SECRET
        source: "Vercel Project Settings → Deployment Protection → Bypass Token"
    dashboard_config:
      - task: "Toggle 'Stage and manually promote production deployments'"
        location: "Project Settings → Deployment Protection → Production Deployments"
      - task: "Add Neon via Marketplace"
        location: "Project → Storage → Neon → Add"
      - task: "Add Vercel Blob store"
        location: "Project → Storage → Blob → Create"
  - service: neon
    why: "Postgres datastore; auto-injects DATABASE_URL/DATABASE_URL_UNPOOLED via Vercel Marketplace"
    env_vars:
      - name: DATABASE_URL
        source: "Vercel Marketplace (Neon integration auto-injects to all envs)"
      - name: DATABASE_URL_UNPOOLED
        source: "Vercel Marketplace (Neon integration auto-injects)"
  - service: sentry
    why: "Error monitoring + P1 alert routing"
    env_vars:
      - name: SENTRY_DSN
        source: "Sentry project settings → Client Keys (DSN)"
      - name: SENTRY_AUTH_TOKEN
        source: "Sentry → User Settings → Auth Tokens (scope: project:releases)"
      - name: SENTRY_ORG
        source: "Sentry org slug"
      - name: SENTRY_PROJECT
        source: "Sentry project slug (e.g. cultural-layer-recklinghausen)"
    dashboard_config:
      - task: "Install Telegram Alerts Bot integration"
        location: "Sentry → Settings → Integrations → Telegram Alerts Bot"
      - task: "Create alert rule: severity=P1 → notify Telegram channel"
        location: "Sentry → Project → Alerts → New Alert Rule"
  - service: resend
    why: "Magic-link delivery (used in Phase 1, wired in Phase 0)"
    env_vars:
      - name: RESEND_API_KEY
        source: "Resend Dashboard → API Keys (sending scope)"
    dashboard_config:
      - task: "Phase 0 uses 'onboarding@resend.dev' as From; custom domain DEFERRED to Phase 6"
        location: "Resend Dashboard → Domains (no action required for Phase 0)"
  - service: upstash
    why: "Rate limit primitive (sliding-window counters in serverless Redis)"
    env_vars:
      - name: UPSTASH_REDIS_REST_URL
        source: "Upstash Console → Database → REST API"
      - name: UPSTASH_REDIS_REST_TOKEN
        source: "Upstash Console → Database → REST API"
  - service: github
    why: "Branch protection on main + Actions secrets"
    dashboard_config:
      - task: "Configure branch protection: require typecheck/lint/vitest/playwright status checks before merge to main"
        location: "GitHub → Settings → Branches → Add rule for 'main'"
      - task: "Add repo secrets: SENTRY_AUTH_TOKEN, VERCEL_AUTOMATION_BYPASS_SECRET"
        location: "GitHub → Settings → Secrets and variables → Actions"

must_haves:
  truths:
    - "A push to main runs 4 CI jobs (typecheck/lint/vitest/playwright) and merge is blocked unless all pass"
    - "A merge to main produces a Vercel preview deployment that does NOT auto-promote to production"
    - "All 10 domain tables (users, artist_profiles, venue_profiles, event_proposals, venue_listings, events, event_messages, tickets, audit_log, magic_link_tokens) plus Better Auth tables (user, session, account, verification) exist in Neon"
    - "DB CHECK 'events.capacity > 0' rejects capacity=0 inserts"
    - "DB CHECK '(events.status=published) = (artistAck AND venueAck)' rejects mismatched state"
    - "tickets(eventId,userId) UNIQUE rejects duplicate RSVP"
    - "tickets.qrHash UNIQUE; magic_link_tokens.tokenHash UNIQUE"
    - "All 8 day-1 indexes exist (verifiable via pg_indexes query)"
    - "audit() helper writes to audit_log; supports actorUserId=NULL for system actions; passes testcontainers unit test"
    - "A deliberate error from /api/_test-sentry surfaces in Sentry within 60s and triggers a P1 Telegram alert"
    - "Placeholder landing at / passes Lighthouse Mobile ≥ 90 on perf+a11y"
    - "Landing has zero WCAG 2.1 AA violations per axe-core"
    - "GDPR cookie banner renders on / in German with no analytics cookies set before consent"
    - "No secrets in git: gitleaks pre-commit hook blocks .env*, API keys"
    - "Vercel ENV separation: distinct values for dev/preview/prod for RESEND_API_KEY, BETTER_AUTH_SECRET, BLOB_READ_WRITE_TOKEN, DATABASE_URL"
    - "Better Auth wiring (route handler, magicLink+Resend slot, schema-bound Drizzle adapter, signup hook to domain users) compiles AND `auth.api.getSession({ headers: new Headers() })` returns null without throwing (smoke test in tests/integration/better-auth-smoke.test.ts)"
  artifacts:
    - path: "src/db/schema.ts"
      provides: "10 domain tables with all CHECK / UNIQUE / index constraints"
      contains: "pgTable('events'"
      min_lines: 200
    - path: "drizzle/0000_initial.sql"
      provides: "Initial migration generated by drizzle-kit, applied to Neon"
      contains: "CREATE TABLE"
    - path: "src/db/index.ts"
      provides: "Two clients: db (HTTP, fast reads) + dbTx (WebSocket, transactions)"
      exports: ["db", "dbTx"]
    - path: "src/lib/audit.ts"
      provides: "Server-only audit() helper"
      exports: ["audit", "AuditAction"]
    - path: "src/lib/env.ts"
      provides: "Zod-validated process.env reader"
      exports: ["env"]
    - path: "src/lib/auth.ts"
      provides: "Better Auth instance with magicLink+Resend+Drizzle adapter (schema-bound) + databaseHooks signup bridge to domain users"
      exports: ["auth"]
    - path: "src/db/auth-schema.ts"
      provides: "Drizzle pgTable declarations for Better Auth's user/session/account/verification tables"
      exports: ["user", "session", "account", "verification"]
    - path: "src/lib/ratelimit.ts"
      provides: "Upstash rate-limit instances per surface (magic-link, ticket-redeem)"
      exports: ["magicLinkLimit", "ticketRedeemLimit"]
    - path: "src/app/page.tsx"
      provides: "Placeholder landing route"
      contains: "export default"
    - path: "src/app/api/auth/[...all]/route.ts"
      provides: "Better Auth catch-all route handler"
      exports: ["GET", "POST"]
    - path: "src/components/cookie-banner.tsx"
      provides: "GDPR cookie banner client component (vanilla-cookieconsent, DE locale)"
      exports: ["CookieBanner"]
    - path: ".github/workflows/ci.yml"
      provides: "typecheck + lint + vitest jobs on PR + push to main"
      contains: "pnpm tsc --noEmit"
    - path: ".github/workflows/e2e.yml"
      provides: "Playwright job triggered on Vercel deployment_status=success/Preview"
      contains: "deployment_status"
    - path: ".github/workflows/lighthouse.yml"
      provides: "Lighthouse CI against preview URL with assertion thresholds 0.9"
      contains: "treosh/lighthouse-ci-action"
    - path: "lighthouserc.json"
      provides: "Lighthouse assertion config (perf ≥0.9, a11y ≥0.9)"
      contains: "minScore"
    - path: "instrumentation.ts"
      provides: "Sentry server-side init at project root"
      contains: "Sentry.init"
    - path: "tests/unit/audit.test.ts"
      provides: "Testcontainers-backed unit test for audit() helper"
      contains: "PostgreSqlContainer"
    - path: "tests/e2e/landing.spec.ts"
      provides: "Playwright + axe a11y assertion + cookie-banner render test"
      contains: "WCAG"
    - path: ".env.example"
      provides: "Documents every required ENV var with no real values"
      contains: "DATABASE_URL="
    - path: "docs/runbook.md"
      provides: "Deployment + monitoring + secret-rotation runbook for future-Jakob"
      min_lines: 80
  key_links:
    - from: "src/app/api/auth/[...all]/route.ts"
      to: "src/lib/auth.ts"
      via: "toNextJsHandler(auth)"
      pattern: "toNextJsHandler"
    - from: "src/lib/auth.ts"
      to: "src/db/index.ts"
      via: "drizzleAdapter(db, { provider: 'pg' })"
      pattern: "drizzleAdapter"
    - from: "src/lib/auth.ts"
      to: "Resend client"
      via: "magicLink({ sendMagicLink })"
      pattern: "sendMagicLink"
    - from: "src/lib/audit.ts"
      to: "src/db/schema.ts"
      via: "db.insert(auditLog)"
      pattern: "insert\\(auditLog"
    - from: ".github/workflows/ci.yml"
      to: "package.json scripts"
      via: "pnpm tsc --noEmit / pnpm eslint . / pnpm vitest run"
      pattern: "pnpm (tsc|eslint|vitest)"
    - from: "src/app/layout.tsx"
      to: "src/components/cookie-banner.tsx"
      via: "<CookieBanner />"
      pattern: "CookieBanner"
    - from: "next.config.ts"
      to: "@sentry/nextjs"
      via: "withSentryConfig(...)"
      pattern: "withSentryConfig"
    - from: "drizzle.config.ts"
      to: "src/db/schema.ts"
      via: "schema: './src/db/schema.ts'"
      pattern: "schema:.*schema"
---

<objective>
Stand up a production-grade Next.js 16 + React 19 + Drizzle + Neon + Vercel skeleton with the full locked stack (DEC-013..DEC-022), the 10-table domain schema migrated to Neon, Better Auth wired, Sentry live, GitHub Actions CI gating merges to `main`, a manual production-promotion gate enforced, and every day-1 NFR (REQ-quality-bar) operational from the first deploy. Audit-write infrastructure (REQ-audit-log) is implemented and unit-tested on Postgres testcontainers.

**Purpose:** Phase 0 is the contract. Every subsequent phase ships against a non-negotiable quality bar — typecheck, lint, unit, e2e, Lighthouse ≥90, axe zero violations, Sentry coverage, audit-log, GDPR banner, secret hygiene — instead of "we'll add it later". When this phase is green, Phase 1 starts on solid ground.

**Output:** Deployed Vercel preview URL with: passing 4-job CI, schema migrated, error-to-Sentry round-trip proven, cookie banner rendering, `audit()` helper unit-tested, and a runbook documenting all 5 external services (Vercel/Neon/Sentry/Resend/Upstash) wired with separate dev/preview/prod env values.

Goal-backward derivation: A Phase-1 developer must be able to `git pull && pnpm install && pnpm dev` and have a working stack with no missing env, no missing migration, no missing test infra, no missing CI hook. If any of those fail, Phase 0 is incomplete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/intel/decisions.md
@.planning/intel/constraints.md
@.planning/phases/00-skeleton-infra/00-RESEARCH.md
@.planning/phases/00-skeleton-infra/00-VALIDATION.md
@docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md

<interfaces>
<!-- New interfaces this plan creates. Downstream phases (1+) implement against these contracts. -->

From src/lib/env.ts:
```typescript
export const env: {
  DATABASE_URL: string;            // Neon HTTP URL (pooled)
  DATABASE_URL_UNPOOLED: string;   // Neon WebSocket URL (transactions)
  BETTER_AUTH_SECRET: string;      // ≥32 chars
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;          // re_*
  BLOB_READ_WRITE_TOKEN: string;   // vercel_blob_rw_*
  SENTRY_DSN: string;
  SENTRY_AUTH_TOKEN?: string;      // build-time only
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ENABLE_BOOTSTRAP: 'true' | 'false';  // default 'false', cold-start gate
  ADMIN_EMAIL: string;             // ENV-provisioned admin per REQ-roles-rbac
};
```

From src/db/index.ts:
```typescript
// HTTP driver — fast, no pool, no transactions. Use for SELECT/single-row INSERT.
export const db: ReturnType<typeof drizzle<typeof schema>>;
// WebSocket driver — supports db.transaction(). Use for capacity check, double-ACK race, multi-statement audit.
export const dbTx: ReturnType<typeof drizzleServerless<typeof schema>>;
```

From src/db/schema.ts:
```typescript
// 10 domain tables, exported by name. Drizzle inferred types via $inferSelect / $inferInsert.
export const users, artistProfiles, venueProfiles, eventProposals, venueListings,
              events, eventMessages, tickets, auditLog, magicLinkTokens;
// Enums:
export const userRoleEnum, userStatusEnum, eventStatusEnum,
              proposalStatusEnum, listingStatusEnum, ticketStatusEnum;
```

From src/lib/audit.ts:
```typescript
export type AuditAction =
  | 'event.publish' | 'event.cancel' | 'event.bootstrap'
  | 'user.suspend' | 'user.activate'
  | 'ticket.redeem' | 'ticket.cancel';
export async function audit(params: {
  actorUserId: string | null;
  action: AuditAction | string;
  target: string;
  meta?: Record<string, unknown>;
}): Promise<void>;
```

From src/lib/auth.ts:
```typescript
export const auth: BetterAuthInstance;   // magicLink+Resend, Drizzle adapter, baseURL+secret from env
```

From src/lib/ratelimit.ts:
```typescript
export const magicLinkLimit: Ratelimit;     // 10 / 60s sliding window, key by IP
export const ticketRedeemLimit: Ratelimit;  // 50 / 60s sliding window, key by venueId
```
</interfaces>
</context>

---

## Wave Structure

| Wave | Tasks | Theme | Depends on |
|------|-------|-------|------------|
| 0 | T-00 .. T-12 | Bootstrap: project init, configs, test infra, CI scaffolding | None |
| 1a | T-23, T-24 | Cloud provisioning: vercel link + Neon Marketplace + Blob + Upstash (PROMOTED from old Wave 2 because T-17 below depends on `DATABASE_URL` being live) | Wave 0 |
| 1b | T-13 .. T-22 | Schema + Audit + Landing + Cookie banner (T-17 migrate now correctly runs after T-23/T-24 populated DATABASE_URL in .env.local) | Wave 1a |
| 2 | T-25 .. T-34 | Better Auth + Sentry + production wiring + deploy + branch protection + smoke test | Wave 1b |

Same-wave tasks share no `files_modified` overlap (verified). Wave gates:
- After Wave 0 → `pnpm tsc --noEmit && pnpm eslint .` is green (no source code yet, configs only).
- After Wave 1a → `DATABASE_URL` populated in `.env.local`; `psql "$DATABASE_URL" -c 'SELECT 1'` succeeds; `BLOB_READ_WRITE_TOKEN` + `UPSTASH_REDIS_REST_*` present.
- After Wave 1b → `pnpm vitest run` is green (audit test passes against live Neon-migrated schema mirrored in testcontainer); landing e2e green via Playwright `webServer`.
- After Wave 2 → preview deploy is green, all CI checks pass (typecheck/lint/vitest/secret-scan/playwright [+lighthouse]).

**Rationale (Blocker #2 fix):** T-17 (`drizzle-kit migrate`) requires `DATABASE_URL` populated by T-23 (`vercel link` + Neon Marketplace) and `vercel env pull`. Original ordering placed T-17 in Wave 1 and T-23 in Wave 2 — a wave-dependency violation. Cloud provisioning now runs as Wave 1a so the schema migrate can proceed.

---

## Phase Requirement Coverage

| Requirement | Acceptance Criterion | Tasks |
|-------------|---------------------|-------|
| REQ-quality-bar | CI gate (typecheck + lint + Vitest + Playwright) | T-04, T-09, T-10, T-11, T-30 |
| REQ-quality-bar | Lighthouse Mobile ≥ 90 on `/` | T-11, T-32 |
| REQ-quality-bar | WCAG 2.1 AA — zero axe violations on `/` | T-08, T-21, T-32 |
| REQ-quality-bar | Sentry from day 1 + P1 → Telegram | T-26, T-27, T-32 |
| REQ-quality-bar | p95 < 2s (foundations: Cache Components, edge-cache headers) | T-22, T-32 (validated post-deploy) |
| REQ-quality-bar | Rate-limit primitive in place (concrete use Phase 1+) | T-19 |
| REQ-quality-bar | Audit log on every state-change (helper + table) | T-14, T-18, T-20 |
| REQ-quality-bar | Secrets management — Vercel ENV only, separate dev/preview/prod | T-03, T-12, T-23, T-29 |
| REQ-quality-bar | GDPR cookie banner from day 1 | T-21, T-22 |
| REQ-quality-bar | 80% critical-path test coverage (foundation set; concrete coverage Phase 1+) | T-09, T-10 (infra), T-20 (audit test sets template) |
| REQ-audit-log | `audit()` writes a row to audit_log | T-18, T-25 (signup hook), T-20 (helper test) |
| REQ-audit-log | `actorUserId = NULL` for system actions accepted | T-14 (schema), T-18 (helper), T-20 (test) |
| REQ-audit-log | Index `audit_log(target, createdAt DESC)` present | T-14, T-17 |

---

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Vercel Function | Untrusted user input (cookie consent, future magic-link request) crosses into Node runtime |
| Vercel Function → Neon | Server-validated SQL via Drizzle parameterised queries |
| Vercel Function → Resend | Outbound email API call with secret API key |
| GitHub → Vercel | Webhook-driven deploy; bypass token used for Playwright preview access |
| Sentry → Telegram | First-party org integration; no custom webhook server |
| Developer laptop → Git | `.env*` and other secrets must NOT cross this boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-0-01 | Information Disclosure | `.env.local`, secret files | mitigate | T-03: `.gitignore` excludes `.env*` (allow `.env.example`); T-05: gitleaks pre-commit hook blocks any committed secret; T-29: secrets only in Vercel ENV (separate dev/preview/prod), never echoed in CI logs |
| T-0-02 | Information Disclosure (PII) | `audit_log.actorIp`, `audit_log.actorUserAgent` | accept (with documentation) | Spec §6 mandates audit on actor identity; v1 does NOT yet write IP/UA per CON-data-model (audit_log columns are id/actorUserId/action/target/meta/createdAt only). DOCUMENT in T-33 runbook: "if Phase 7 adds IP/UA columns, retention policy must apply (recommend 90-day purge cron)". |
| T-0-03 | Spoofing / SSRF | Sentry → Telegram alert routing | mitigate | T-27: use Sentry's first-party Telegram Alerts Bot integration; do NOT hand-roll a webhook server. First-party integration uses OAuth bridge; no SSRF surface. |
| T-0-04 | Tampering / Privacy violation | Cookie banner | mitigate | T-21: `vanilla-cookieconsent` v3 in blocking mode by default — no analytics/tracking cookies set before user opts in. Phase 0 ships with only `necessary` category enabled; no analytics added until consent flow is exercised in a future phase. |
| T-0-05 | Denial of Service / Spam | `/api/_test-sentry` debug route | mitigate | T-26: route is gated by an env-flag check (`process.env.NODE_ENV !== 'production'` OR `process.env.ENABLE_TEST_SENTRY === 'true'`) and a query-param token (`?token=$DEBUG_TOKEN` matched against env). After Phase 0 verification, T-32 acceptance includes flipping `ENABLE_TEST_SENTRY=false` in prod. |
| T-0-06 | Tampering | Drizzle migration replay/skip | mitigate | T-17: drizzle-kit `generate` writes versioned files to `drizzle/`; T-31 CI step runs `drizzle-kit migrate` (not `push`) so journal is honored; production deploys never use `push` per anti-patterns. |
| T-0-07 | Elevation of Privilege | Better Auth `user` table vs domain `users` table | mitigate | T-25: documented FK strategy (Better Auth manages own tables; our `users` row created via signup hook with role from invite). Phase 1 will exercise the hook; Phase 0 only wires the route handler so collision risk surfaces immediately. |
| T-0-08 | Repudiation | State changes without audit | mitigate | T-18: `audit()` helper centralises every write; T-20: unit test asserts the row exists. Phase 1+ tasks MUST call `audit()` on every state mutation (enforced via code review + verification gates). |
| T-0-09 | Information Disclosure | Sentry source-map upload silently fails | mitigate | T-27: SENTRY_AUTH_TOKEN added to both Vercel ENV (all 3) and GitHub Actions secrets; T-32 acceptance: trigger error and verify Sentry shows original file/line, not minified. |
| T-0-10 | Tampering | Vercel Preview URLs publicly accessible during E2E | accept | Vercel Deployment Protection bypass token is used by Playwright; preview URLs themselves are obfuscated. Acceptable risk for Phase 0 placeholder content. Re-evaluate at Phase 4 (RSVP data live). |

**Block list (HIGH severity):** None. T-0-01..T-0-09 are mitigated; T-0-02, T-0-10 are explicitly accepted with documented re-evaluation triggers.

</threat_model>

---

<tasks>

<!-- ====================================================================== -->
<!-- WAVE 0 — BOOTSTRAP (T-00 .. T-12)                                       -->
<!-- ====================================================================== -->

<task type="checkpoint:human-action" gate="blocking">
  <name>T-00: Upgrade Vercel CLI to ≥ 52 (manual)</name>
  <what-built>Phase 0 requires Vercel CLI commands not present in 50.44 (`vercel integration add neon`, current ENV manager). STATE.md flags this as blocker.</what-built>
  <how-to-verify>
    1. Run: `pnpm add -g vercel@latest`
    2. Run: `vercel --version` — confirm output is `52.x` or higher
    3. Reply with the version string
  </how-to-verify>
  <resume-signal>Type "vercel CLI 52.x installed" or paste version output</resume-signal>
</task>

<task type="auto">
  <name>T-01: Initialize Next.js 16 project with create-next-app</name>
  <files>package.json, pnpm-lock.yaml, tsconfig.json, eslint.config.mjs, src/app/layout.tsx (placeholder), src/app/page.tsx (placeholder), src/app/globals.css, next.config.ts (placeholder), .gitignore, README.md</files>
  <action>
Run `pnpm dlx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-install` from the repo root (NB: `.` to scaffold into existing dir alongside `.planning/` and `docs/`).

Then run `pnpm install` to install. The placeholder `src/app/page.tsx` and `src/app/layout.tsx` will be REPLACED in T-22 — leave them for now so the dev server boots.

If create-next-app refuses to scaffold into a non-empty directory, scaffold into `tmp-next/`, then move all `tmp-next/*` and `tmp-next/.*` files (preserving `.planning/`, `docs/`, `.git/`) into the repo root, then `rm -rf tmp-next/`.

After install, verify pinned versions match RESEARCH.md `## Standard Stack` (Next 16.2.4, React 19.2.5). If create-next-app pulled a newer minor, run `pnpm add next@16.2.4 react@19.2.5 react-dom@19.2.5 eslint-config-next@16.2.4` to lock per RESEARCH.md.

DEC-013 lock; greenfield bootstrap (DEC-002).
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); if (!p.dependencies.next?.startsWith('16.')) process.exit(1); console.log('Next', p.dependencies.next);"</automated>
  </verify>
  <done>`pnpm dev` starts (manually verify once at end of Wave 0); `package.json` has `next@16.x`, `react@19.x`, `tailwindcss@4.x`; `src/app/` exists; `tsconfig.json` has `paths: { "@/*": ["./src/*"] }`</done>
</task>

<task type="auto">
  <name>T-02: Tighten tsconfig.json + eslint.config.mjs to strict mode</name>
  <files>tsconfig.json, eslint.config.mjs</files>
  <action>
Edit `tsconfig.json` `compilerOptions` to ensure all of: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"forceConsistentCasingInFileNames": true`, `"verbatimModuleSyntax": true`. Keep create-next-app defaults for `target` (ES2022+) and `module`/`moduleResolution`.

Edit `eslint.config.mjs` (flat config from create-next-app) to add stricter rules per RESEARCH.md State of the Art (no `next lint`):
- Extend `eslint-config-next` (already imported by scaffold)
- Add explicit rule: `'@typescript-eslint/no-explicit-any': 'error'`
- Add `'@typescript-eslint/consistent-type-imports': 'error'`
- Add ignore patterns: `['drizzle/**', '.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**']`

Required by REQ-quality-bar CI gate (typecheck + lint must pass to merge).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && pnpm eslint . --max-warnings 0</automated>
  </verify>
  <done>`pnpm tsc --noEmit` exits 0; `pnpm eslint .` exits 0; `tsconfig.json` has `noUncheckedIndexedAccess: true`</done>
</task>

<task type="auto">
  <name>T-03: Write .gitignore + .env.example + Prettier config</name>
  <files>.gitignore, .env.example, .prettierrc.json, .prettierignore</files>
  <action>
**`.gitignore`** — ensure (extend, don't replace, what create-next-app generated):
```
# Env (DO NOT commit any of these except .env.example)
.env
.env.local
.env.development
.env.preview
.env.production
.env.*.local

# Vercel
.vercel/
.vercel/*

# Tests
coverage/
playwright-report/
test-results/
.lighthouseci/

# Drizzle local snapshots (keep migrations + journal, ignore local snapshot if any)
# (drizzle/ stays committed)
```

**`.env.example`** — document every var from `src/lib/env.ts` (T-13) ahead of time, with placeholder values:
```
# Database (auto-injected by Vercel Marketplace Neon)
DATABASE_URL=postgres://USER:PASS@HOST/DB?sslmode=require
DATABASE_URL_UNPOOLED=postgres://USER:PASS@HOST/DB?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=change-me-min-32-chars-cryptorandom-string
BETTER_AUTH_URL=http://localhost:3000

# Resend (transactional email)
RESEND_API_KEY=re_xxx

# Vercel Blob (auto-injected when Blob store created)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=cultural-layer-recklinghausen

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Cold-start (Phase 7 enables; Phase 0 default false)
ENABLE_BOOTSTRAP=false

# Phase 1: ENV-provisioned admin per REQ-roles-rbac
ADMIN_EMAIL=admin@example.com

# Phase 0 only: Sentry test route gate (set to 'true' to enable /api/_test-sentry in non-prod)
ENABLE_TEST_SENTRY=true
DEBUG_TOKEN=change-me-cryptorandom

# Vercel Deployment Protection bypass for Playwright (Preview URL access)
VERCEL_AUTOMATION_BYPASS_SECRET=change-me-from-vercel-dashboard
```

**`.prettierrc.json`** — minimal: `{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }`
**`.prettierignore`** — `pnpm-lock.yaml`, `drizzle/**`, `.next/**`, `coverage/**`, `*.md` (preserve hand-edited markdown formatting)

T-0-01 mitigation (no secrets in git).
  </action>
  <verify>
    <automated>grep -q '\.env\.local' .gitignore && grep -q 'DATABASE_URL' .env.example && test -f .prettierrc.json</automated>
  </verify>
  <done>`.env.local` is gitignored; `.env.example` documents every required var; `.prettierrc.json` exists</done>
</task>

<task type="auto">
  <name>T-04: Add package.json scripts for dev / build / test pipeline</name>
  <files>package.json</files>
  <action>
Edit `package.json` `scripts` section to add (preserve `dev`, `build`, `start`, `lint` from create-next-app):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test:unit": "vitest run",
  "test:unit:watch": "vitest",
  "test:e2e": "playwright test",
  "test": "pnpm typecheck && pnpm lint && pnpm test:unit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "prepare": "husky"
}
```

The composite `test` script is what CI runs as the local-feedback gate. Playwright runs in a separate workflow against the deployed preview (per RESEARCH.md Pattern 5). REQ-quality-bar.
  </action>
  <verify>
    <automated>node -e "const s=require('./package.json').scripts; ['typecheck','lint','test:unit','test:e2e','db:generate','db:migrate'].forEach(k=>{if(!s[k])throw new Error('missing '+k)});"</automated>
  </verify>
  <done>All 12+ scripts present; `pnpm typecheck` and `pnpm lint` succeed (no source code yet, but configs valid)</done>
</task>

<task type="auto">
  <name>T-05: Install Husky + gitleaks pre-commit hook</name>
  <files>.husky/pre-commit, .gitleaks.toml, package.json</files>
  <action>
Install: `pnpm add -D husky lint-staged`. Initialize: `pnpm exec husky init`.

Write `.husky/pre-commit`:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Block secrets in commits (T-0-01)
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --redact --no-banner
else
  echo "WARN: gitleaks not installed; skipping secret scan. Install: brew install gitleaks (or curl from github releases)"
fi

# Format + lint staged files
pnpm exec lint-staged
```
`chmod +x .husky/pre-commit`.

Write `.gitleaks.toml` with default rules + custom rule for `re_*`/`vercel_blob_rw_*`/`sntrys_*`/`UPSTASH_REDIS_REST_TOKEN`:
```toml
[extend]
useDefault = true

[[rules]]
id = "resend-key"
description = "Resend API key"
regex = '''re_[A-Za-z0-9]{32,}'''
[[rules]]
id = "blob-token"
description = "Vercel Blob token"
regex = '''vercel_blob_rw_[A-Za-z0-9]{20,}'''
[[rules]]
id = "sentry-auth-token"
description = "Sentry auth token"
regex = '''sntrys_[A-Za-z0-9]{20,}'''
```

Add `lint-staged` config to `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

T-0-01 mitigation. If gitleaks binary is missing locally, the hook warns but does not block — gitleaks IS run in CI (T-10 will add a secret-scan job).
  </action>
  <verify>
    <automated>test -x .husky/pre-commit && test -f .gitleaks.toml && grep -q 'lint-staged' package.json</automated>
  </verify>
  <done>Pre-commit hook executable; `.gitleaks.toml` defines extended rules; `lint-staged` block in `package.json`</done>
</task>

<task type="auto">
  <name>T-06: Install test infra deps (Vitest + Playwright + testcontainers + axe)</name>
  <files>package.json, pnpm-lock.yaml</files>
  <action>
Run all three install commands (per RESEARCH.md `Installation`):
```bash
pnpm add -D vitest@4.1.5 @vitest/ui @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
pnpm add -D @playwright/test@1.59.1
pnpm add -D testcontainers@11.14.0 @testcontainers/postgresql pg @types/pg
pnpm add -D @axe-core/playwright
```

After install: `pnpm playwright install --with-deps chromium` (downloads Chromium for local + CI use).

DEC-018 lock. Versions per RESEARCH.md.
  </action>
  <verify>
    <automated>node -e "const d=require('./package.json').devDependencies; ['vitest','@playwright/test','testcontainers','@testcontainers/postgresql','@axe-core/playwright'].forEach(k=>{if(!d[k])throw new Error('missing '+k)});"</automated>
  </verify>
  <done>All test deps installed; Chromium downloaded; `pnpm playwright --version` succeeds</done>
</task>

<task type="auto" tdd="true">
  <name>T-07: Write vitest.config.ts</name>
  <files>vitest.config.ts</files>
  <behavior>
    - Vitest runs against `tests/**/*.test.ts` and `src/**/*.test.ts`
    - jsdom env for component tests, node env for integration (use `// @vitest-environment` directive when needed)
    - `--coverage` produces v8 report; coverage threshold NOT enforced in Phase 0 (no production code yet beyond infra) — set thresholds to 0; Phase 1 raises to 80%
    - `@/*` alias resolves to `./src/*` (mirror tsconfig)
    - Integration tests via testcontainers MUST run sequentially (`fileParallelism: false` for `tests/unit/audit*.test.ts`) per Pitfall 7
  </behavior>
  <action>
Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: false,
    environment: 'node',  // override per-file with "// @vitest-environment jsdom"
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Phase 0: no production code — thresholds set to 0; Phase 1+ raises to 80% per REQ-quality-bar.
      thresholds: { lines: 0, functions: 0, statements: 0, branches: 0 },
    },
    // Pitfall 7: testcontainers tests cannot run in parallel within a file
    poolOptions: {
      forks: { singleFork: false },
    },
    // Make test runs deterministic for CI
    sequence: { concurrent: false },
  },
});
```

REQ-quality-bar (test infra foundation). Pitfall 7 mitigated via sequential execution.
  </action>
  <verify>
    <automated>pnpm vitest run --reporter=basic --passWithNoTests</automated>
  </verify>
  <done>Vitest config loads; `pnpm vitest run --passWithNoTests` exits 0 (no tests yet)</done>
</task>

<task type="auto" tdd="true">
  <name>T-08: Write playwright.config.ts + axe e2e fixture</name>
  <files>playwright.config.ts, tests/e2e/fixtures.ts</files>
  <behavior>
    - Playwright targets Chromium only initially (REQ-quality-bar Lighthouse Mobile is what matters)
    - `baseURL` from env: `PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'` (CI sets it to Vercel preview URL)
    - When base is a Vercel preview URL, send `extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }`
    - axe fixture exposes `makeAxeBuilder()` factory that pre-tags WCAG 2.1 AA rules (matches RESEARCH.md fixture)
  </behavior>
  <action>
Create `playwright.config.ts` (per RESEARCH.md + Pattern 5):
```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000';
const isPreview = baseURL.includes('vercel.app');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    extraHTTPHeaders: isPreview && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  // Local-only: spin up dev server. CI uses pre-deployed preview URL.
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

Create `tests/e2e/fixtures.ts` (mirror RESEARCH.md exactly):
```typescript
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Fixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<Fixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    const make = () =>
      new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    await use(make);
  },
});
export { expect };
```

REQ-quality-bar (a11y + e2e gate). T-0-10: Playwright bypass token is the controlled access path to Preview URLs.
  </action>
  <verify>
    <automated>pnpm playwright test --list 2>&1 | grep -q 'No tests found' || pnpm playwright test --list</automated>
  </verify>
  <done>Playwright config loads; `pnpm playwright test --list` runs without crash; axe fixture compiles</done>
</task>

<task type="auto">
  <name>T-09: Write tests/setup/pg-container.ts (shared testcontainers helper)</name>
  <files>tests/setup/pg-container.ts</files>
  <action>
Create the shared helper that future integration tests reuse. Per RESEARCH.md Pitfall 7, default to per-file container (slower but bulletproof):
```typescript
// tests/setup/pg-container.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export type TestContext = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: TestDb;
};

export async function startPgWithMigrations(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return { container, pool, db };
}

export async function stopPg(ctx: TestContext): Promise<void> {
  await ctx.pool.end();
  await ctx.container.stop();
}
```

Note: this file imports `@/db/schema` (T-14) and reads `./drizzle/` (T-17). It will TYPECHECK after T-14 is done — Wave 0 leaves it stub-importable but not executable. The test in T-20 brings it to life.

REQ-audit-log infra; DEC-018 (testcontainers).
  </action>
  <verify>
    <automated>test -f tests/setup/pg-container.ts && grep -q 'PostgreSqlContainer' tests/setup/pg-container.ts</automated>
  </verify>
  <done>File exists; exports `startPgWithMigrations` + `stopPg`; will compile cleanly after T-14 schema lands</done>
</task>

<task type="auto">
  <name>T-10: Write GitHub Actions ci.yml (typecheck + lint + vitest + secret scan)</name>
  <files>.github/workflows/ci.yml</files>
  <action>
Create `.github/workflows/ci.yml` (extends RESEARCH.md Pattern 5 with secret scan):
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  lint:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  vitest:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # ubuntu-24.04 runner has Docker preinstalled (testcontainers needs it)
      - run: pnpm test:unit -- --coverage

  secret-scan:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Note: Playwright job is in `e2e.yml` (T-11), triggered separately by `deployment_status`. CI here is the fast-feedback path.

REQ-quality-bar CI gate. T-0-01 backstop (gitleaks-action runs on every PR).
  </action>
  <verify>
    <automated>test -f .github/workflows/ci.yml && grep -qE '(typecheck|lint|vitest|secret-scan):' .github/workflows/ci.yml</automated>
  </verify>
  <done>4 jobs defined; concurrency cancels stale runs; gitleaks on every PR</done>
</task>

<task type="auto">
  <name>T-11: Write GitHub Actions e2e.yml + lighthouse.yml (deployment_status triggers)</name>
  <files>.github/workflows/e2e.yml, .github/workflows/lighthouse.yml, lighthouserc.json</files>
  <action>
Create `.github/workflows/e2e.yml` (per RESEARCH.md Pattern 5 + Code Examples):
```yaml
name: E2E (Playwright)
on:
  deployment_status:

jobs:
  playwright:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview'
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm test:e2e
        env:
          PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
          CI: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Create `.github/workflows/lighthouse.yml` (per RESEARCH.md Code Examples):
```yaml
name: Lighthouse
on:
  deployment_status:

jobs:
  lighthouse:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            ${{ github.event.deployment_status.target_url }}/
          configPath: ./lighthouserc.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

Create `lighthouserc.json` (Warning #4 fix: REQ-quality-bar mandates **Mobile ≥ 90** — preset MUST be mobile from day 1; if the placeholder landing can't hit 0.9 mobile, that's the day-1 bar this phase exists to enforce — fix the landing in T-22, not the threshold):
```json
{
  "ci": {
    "collect": {
      "settings": {
        "preset": "mobile",
        "throttlingMethod": "simulate"
      },
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["warn", { "minScore": 0.9 }]
      }
    }
  }
}
```

`preset: mobile` from the start enforces REQ-quality-bar Lighthouse-Mobile-≥90 as the CI gate. The placeholder landing in T-22 is text-only with no images/scripts — it should comfortably hit 0.9 mobile. If the first preview deploy fails mobile perf/a11y, T-22 must be tightened (preload font, ensure no offscreen content, add edge cache headers) — Phase 0's contract is "ship green or don't ship".

REQ-quality-bar (CI gate + Lighthouse Mobile + a11y + perf).
  </action>
  <verify>
    <automated>test -f .github/workflows/e2e.yml && test -f .github/workflows/lighthouse.yml && test -f lighthouserc.json && grep -q 'minScore' lighthouserc.json</automated>
  </verify>
  <done>Both workflows trigger on `deployment_status`; lighthouserc enforces 0.9 thresholds for perf+a11y</done>
</task>

<task type="auto">
  <name>T-12: Write drizzle.config.ts</name>
  <files>drizzle.config.ts</files>
  <action>
Install Drizzle deps now (split from T-13 to keep this Wave 0):
```bash
pnpm add drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0
pnpm add -D drizzle-kit@0.31.10
```

Create `drizzle.config.ts` (per RESEARCH.md Code Examples):
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder/none',
  },
  verbose: true,
  strict: true,
});
```

Note: schema file `src/db/schema.ts` doesn't exist yet (T-14 creates it). drizzle-kit only complains when `generate`/`migrate` is invoked — config file alone is fine.

DEC-009 + DEC-010 lock.
  </action>
  <verify>
    <automated>test -f drizzle.config.ts && grep -q 'src/db/schema.ts' drizzle.config.ts</automated>
  </verify>
  <done>drizzle.config.ts exists; drizzle-orm + drizzle-kit + @neondatabase/serverless installed</done>
</task>

<!-- ====================================================================== -->
<!-- WAVE 1 — SCHEMA + AUDIT + LANDING + COOKIE BANNER (T-13 .. T-22)        -->
<!-- ====================================================================== -->

<task type="auto" tdd="true">
  <name>T-13: Write src/lib/env.ts (zod-validated env reader)</name>
  <files>src/lib/env.ts</files>
  <behavior>
    - `env.DATABASE_URL` is a valid URL
    - `env.BETTER_AUTH_SECRET` is ≥32 chars
    - `env.RESEND_API_KEY` starts with `re_`
    - `env.BLOB_READ_WRITE_TOKEN` starts with `vercel_blob_rw_`
    - `env.SENTRY_DSN` is a valid URL; `env.SENTRY_AUTH_TOKEN` is optional (build-time only)
    - `env.UPSTASH_REDIS_REST_URL` is a valid URL
    - `env.ENABLE_BOOTSTRAP` defaults to `'false'` (string union, not boolean — Vercel env vars are strings)
    - `env.ADMIN_EMAIL` is a valid email
    - On parse failure, throws with helpful zod error (so missing var fails fast at server start)
  </behavior>
  <action>
Install zod first (it's an app dep, not dev dep): `pnpm add zod@4.3.6`.

Create `src/lib/env.ts` (per RESEARCH.md Code Examples) — already-installed zod 4.3.6:
```typescript
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().startsWith('re_'),
  BLOB_READ_WRITE_TOKEN: z.string().startsWith('vercel_blob_rw_').optional(),
  SENTRY_DSN: z.string().url().optional(),    // optional during local dev
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ENABLE_BOOTSTRAP: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email().optional(), // required Phase 1+, optional Phase 0
  ENABLE_TEST_SENTRY: z.enum(['true', 'false']).default('false'),
  DEBUG_TOKEN: z.string().min(16).optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
```

Phase 0 keeps several vars `.optional()` because the local dev environment may not have everything wired yet (e.g., Sentry DSN is empty until T-26). Phase 1+ tasks tighten the schema as they consume each var.

DEC-015 (Zod). T-0-01 secondary check (no secret means parse fails loudly).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit src/lib/env.ts 2>&1 | grep -v "lib/env" || true; pnpm tsc --noEmit</automated>
  </verify>
  <done>File exports `env` and `Env` type; `pnpm tsc --noEmit` passes</done>
</task>

<task type="auto" tdd="true">
  <name>T-14: Write src/db/schema.ts (10 domain tables, all CHECKs, all 8 indexes)</name>
  <files>src/db/schema.ts</files>
  <behavior>
    - All 10 tables exist: users, artistProfiles, venueProfiles, eventProposals, venueListings, events, eventMessages, tickets, auditLog, magicLinkTokens
    - Enums: userRoleEnum, userStatusEnum, eventStatusEnum, proposalStatusEnum, listingStatusEnum, ticketStatusEnum
    - DB CHECKs (using `sql\`...\`` template literals — NOT Drizzle filter operators per Pitfall 2):
      - `events.capacity > 0`
      - `(events.status = 'published') = (events.artistAck AND events.venueAck)`
    - UNIQUE constraints:
      - `users.email`
      - `tickets(eventId, userId)` composite
      - `tickets.qrHash`
      - `magic_link_tokens.tokenHash`
    - 8 day-1 indexes:
      - `events(status, startAt)`
      - `events(artistId, status)`
      - `events(venueId, status)`
      - `event_proposals(status, createdAt DESC)`
      - `venue_listings(status, createdAt DESC)`
      - `tickets(eventId, status)`
      - `tickets(userId, status)`
      - `audit_log(target, createdAt DESC)`
    - FK on-delete behaviour matches CON-edge-cases:
      - `artist_profiles.userId` → `users.id` ON DELETE CASCADE (artist_profiles row dies with user)
      - `venue_profiles.userId` → `users.id` ON DELETE CASCADE
      - `events.artistId` / `events.venueId` → `users.id` (NO CASCADE — events preserved when artist deleted; UI shows "Artist removed")
      - `event_messages.eventId` → `events.id` ON DELETE CASCADE
      - `tickets.eventId` / `tickets.userId` → `users.id` ON DELETE RESTRICT (prevent accidental data loss; cancellation flow is the supported path)
  </behavior>
  <action>
Create `src/db/schema.ts` per RESEARCH.md Pattern 1 (full 10-table version, not just events+tickets shown there). Structure:

```typescript
import {
  pgTable, pgEnum, uuid, text, integer, numeric, timestamp, boolean,
  date, check, unique, index, jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---- Enums (CON-data-model §6) ----
export const userRoleEnum = pgEnum('user_role', ['public', 'artist', 'venue', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'email_invalid']);
export const eventStatusEnum = pgEnum('event_status', ['proposed', 'published', 'cancelled', 'completed']);
export const proposalStatusEnum = pgEnum('proposal_status', ['open', 'withdrawn', 'closed']);
export const listingStatusEnum = pgEnum('listing_status', ['open', 'withdrawn', 'closed']);
export const ticketStatusEnum = pgEnum('ticket_status', ['active', 'used', 'cancelled']);

// ---- users ----
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('users_email_uq').on(t.email)],
);

// ---- artist_profiles (PK = userId, CASCADE delete) ----
export const artistProfiles = pgTable('artist_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  portfolioBlobs: jsonb('portfolio_blobs').$type<Array<{ url: string; alt: string; order: number }>>(),
});

// ---- venue_profiles (PK = userId, CASCADE delete) ----
export const venueProfiles = pgTable('venue_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressPostal: text('address_postal'),
  geoLat: numeric('geo_lat'),
  geoLon: numeric('geo_lon'),
  capacity: integer('capacity').notNull(),
  photoBlobs: jsonb('photo_blobs').$type<Array<{ url: string; alt: string }>>(),
  description: text('description'),
});

// ---- event_proposals ----
export const eventProposals = pgTable(
  'event_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artistId: uuid('artist_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    preferredDates: date('preferred_dates').array(),
    capacityWanted: integer('capacity_wanted'),
    posterBlob: text('poster_blob'),
    status: proposalStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('proposals_status_created_idx').on(t.status, t.createdAt.desc()),
  ],
);

// ---- venue_listings ----
export const venueListings = pgTable(
  'venue_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    venueId: uuid('venue_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    availableDates: date('available_dates').array(),
    status: listingStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listings_status_created_idx').on(t.status, t.createdAt.desc()),
  ],
);

// ---- events (the heart of the marketplace) ----
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artistId: uuid('artist_id').notNull().references(() => users.id),
    venueId: uuid('venue_id').notNull().references(() => users.id),
    sourceProposalId: uuid('source_proposal_id').references(() => eventProposals.id),
    sourceListingId: uuid('source_listing_id').references(() => venueListings.id),
    title: text('title').notNull(),
    description: text('description'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull(),
    posterBlob: text('poster_blob'),
    status: eventStatusEnum('status').notNull().default('proposed'),
    artistAck: boolean('artist_ack').notNull().default(false),
    venueAck: boolean('venue_ack').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledReason: text('cancelled_reason'),
    bootstrapped: boolean('bootstrapped').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // CRITICAL: sql template literals only — Drizzle filter operators emit $1 placeholders Postgres rejects
    check('events_capacity_positive', sql`${t.capacity} > 0`),
    check(
      'events_published_iff_both_ack',
      sql`(${t.status} = 'published') = (${t.artistAck} AND ${t.venueAck})`,
    ),
    index('events_status_start_idx').on(t.status, t.startAt),
    index('events_artist_status_idx').on(t.artistId, t.status),
    index('events_venue_status_idx').on(t.venueId, t.status),
  ],
);

// ---- event_messages ----
export const eventMessages = pgTable('event_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  senderUserId: uuid('sender_user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- tickets ----
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    qrHash: text('qr_hash').notNull(),
    status: ticketStatusEnum('status').notNull().default('active'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [
    unique('tickets_event_user_uq').on(t.eventId, t.userId),
    unique('tickets_qrhash_uq').on(t.qrHash),
    index('tickets_event_status_idx').on(t.eventId, t.status),
    index('tickets_user_status_idx').on(t.userId, t.status),
  ],
);

// ---- audit_log ----
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),  // nullable = system action
    action: text('action').notNull(),
    target: text('target').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_target_created_idx').on(t.target, t.createdAt.desc()),
  ],
);

// ---- magic_link_tokens ----
export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),  // HMAC, never plaintext
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [
    unique('magic_link_tokenhash_uq').on(t.tokenHash),
  ],
);
```

CON-data-model fully realised. Pitfall 2 honored (sql templates). REQ-audit-log (audit_log table + index).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && grep -c "pgTable" src/db/schema.ts | awk '{ if ($1 < 10) exit 1 }'</automated>
  </verify>
  <done>10 `pgTable` declarations; 6 enums; 2 CHECKs (sql template form); 4 UNIQUEs; 8 indexes; `pnpm tsc --noEmit` passes</done>
</task>

<task type="auto" tdd="true">
  <name>T-15: Write src/db/index.ts (db + dbTx clients)</name>
  <files>src/db/index.ts</files>
  <behavior>
    - Two named exports: `db` (Neon HTTP, fast reads, no transactions) and `dbTx` (Neon WebSocket pool, transactions)
    - Both wired with the schema from T-14
    - `dbTx` lazy-initialised so dev environments without DATABASE_URL_UNPOOLED can still run unit tests
    - Pitfall 8: HTTP driver MUST NOT be used for `db.transaction()` calls — TypeScript prevents this naturally because `db` is `NeonHttpDatabase` not `NeonDatabase`
  </behavior>
  <action>
Create `src/db/index.ts` per RESEARCH.md Pattern 2 + Pitfall 8:
```typescript
import { neon } from '@neondatabase/serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
import { env } from '@/lib/env';

// HTTP driver — fast, no pool, NO transactions.
// Use for: SELECT, single INSERT/UPDATE/DELETE without transaction guarantees.
const sqlHttp = neon(env.DATABASE_URL);
export const db = drizzleHttp(sqlHttp, { schema });

// WebSocket driver — supports transactions.
// Use for: capacity check (RSVP), double-ACK race (events publish), multi-statement audit.
// Lazy-init: only constructs pool if needed (saves cold-start ms when route doesn't transact).
neonConfig.webSocketConstructor = ws;
let _pool: Pool | null = null;
let _dbTx: ReturnType<typeof drizzleServerless<typeof schema>> | null = null;

function getDbTx() {
  if (!_dbTx) {
    _pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL });
    _dbTx = drizzleServerless(_pool, { schema });
  }
  return _dbTx;
}

// Proxy export so call sites can use `dbTx.transaction(...)` directly.
export const dbTx = new Proxy({} as ReturnType<typeof getDbTx>, {
  get(_, prop) {
    const real = getDbTx() as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema };
```

Install `ws` for the WebSocket driver: `pnpm add ws && pnpm add -D @types/ws`.

DEC-009; Pitfall 8 mitigated.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && grep -q 'export const db ' src/db/index.ts && grep -q 'export const dbTx' src/db/index.ts</automated>
  </verify>
  <done>Both `db` and `dbTx` exported; `pnpm tsc --noEmit` passes; `ws` installed</done>
</task>

<task type="auto" tdd="true">
  <name>T-16: Generate initial Drizzle migration (drizzle-kit generate)</name>
  <files>drizzle/0000_initial.sql, drizzle/meta/_journal.json, drizzle/meta/0000_snapshot.json</files>
  <action>
Run: `pnpm db:generate`. drizzle-kit reads `src/db/schema.ts` and emits SQL DDL to `drizzle/`.

Inspect the generated SQL — verify it contains:
- `CREATE TYPE "public"."event_status" AS ENUM(...)` (and 5 other enums)
- `CREATE TABLE "events"` with `CHECK (...)` clauses inline (NOT separate `ALTER TABLE ADD CONSTRAINT` — Drizzle 0.45 inlines them)
- `CREATE UNIQUE INDEX` for `tickets_event_user_uq`, `tickets_qrhash_uq`, `magic_link_tokenhash_uq`
- `CREATE INDEX "events_status_start_idx" ON "events" ("status","start_at")` and 7 other indexes
- All 10 `CREATE TABLE` statements

If any CHECK constraint shows `$1` placeholders → revert, fix `src/db/schema.ts` to use `sql\`...\`` template literals (Pitfall 2), regenerate.

Commit `drizzle/0000_*.sql` + `drizzle/meta/` to git per DEC-010 (migrations versioned in git).

DEC-010; CON-data-model.
  </action>
  <verify>
    <automated>test -f drizzle/0000_*.sql && grep -c "CREATE TABLE" drizzle/0000_*.sql | awk '{ if ($1 < 10) exit 1 }' && ! grep -E '\$[0-9]+' drizzle/0000_*.sql | head -1</automated>
  </verify>
  <done>10 CREATE TABLE statements; 8 CREATE INDEX statements; CHECK clauses with no `$N` placeholders; meta journal exists</done>
</task>

<task type="auto" tdd="true">
  <name>T-17: [BLOCKING] Apply migration to Neon via drizzle-kit migrate</name>
  <files>drizzle/meta/_journal.json (updated)</files>
  <action>
**This task BLOCKS verification.** Schema must be live in Neon before T-32 can prove the deploy works.

PRECONDITION (satisfied by Wave 1a): T-23 (vercel link + Neon Marketplace) and T-24 (vercel env pull, Blob, Upstash) ran in Wave 1a, populating `DATABASE_URL`/`DATABASE_URL_UNPOOLED` in `.env.local`. Verify before running migrate:

```bash
test -n "$DATABASE_URL" && grep -q '^DATABASE_URL=postgres' .env.local || { echo 'DATABASE_URL missing — re-run T-23/T-24 from Wave 1a'; exit 1; }
```

If the gate above fails, STOP and re-run Wave 1a tasks before proceeding (Wave 1a should already be complete by the time Wave 1b reaches T-17 — this is a defence-in-depth check, not an expected branch).

Run: `pnpm db:migrate`. drizzle-kit applies `drizzle/0000_*.sql` to the Neon database.

Verify by querying directly:
```bash
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```
Expected output (10 domain tables; Better Auth tables are added in T-25, not here):
```
artist_profiles
audit_log
event_messages
event_proposals
events
magic_link_tokens
tickets
users
venue_listings
venue_profiles
```

Verify CHECKs:
```bash
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE contype='c' AND conrelid='events'::regclass;"
```
Expected: `events_capacity_positive`, `events_published_iff_both_ack`.

Verify indexes:
```bash
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_idx';"
```
Expected: 8 indexes per CON-data-model.

DEC-010 (migrate, NOT push, in production); CON-data-model.
  </action>
  <verify>
    <automated>psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','artist_profiles','venue_profiles','event_proposals','venue_listings','events','event_messages','tickets','audit_log','magic_link_tokens');" -t | tr -d ' \n' | grep -q '^10$'</automated>
  </verify>
  <done>All 10 tables exist in Neon; both CHECKs present on `events`; 8 indexes present; `drizzle/meta/_journal.json` updated with applied migration timestamp</done>
</task>

<task type="auto" tdd="true">
  <name>T-18: Write src/lib/audit.ts (server-only audit helper)</name>
  <files>src/lib/audit.ts</files>
  <behavior>
    - `audit()` writes one row to `audit_log` per call
    - Accepts `actorUserId: string | null` (null = system action per spec §6 + REQ-audit-log)
    - `meta` defaults to `{}` if not provided
    - Type-narrowed `AuditAction` enum for known actions; falls through to `string` for forward-compat
    - `'server-only'` import line ensures any accidental client-side import fails the build (T-0-08)
  </behavior>
  <action>
Install: `pnpm add server-only`.

Create `src/lib/audit.ts` per RESEARCH.md Pattern 4, **with dependency-injected db** so testcontainer tests can exercise the helper directly (Blocker #1 fix; satisfies REQ-audit-log SC#4):

```typescript
import 'server-only';
import { db as defaultDb } from '@/db';
import { auditLog } from '@/db/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';

// Accept any Drizzle pg-dialect client that has the same schema bound.
// Production callers omit the second arg → `defaultDb` (Neon HTTP) is used.
// Tests pass the testcontainers `pg` client (NodePgDatabase) for parity with real Postgres.
export type AuditDb =
  | NeonHttpDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

export type AuditAction =
  | 'event.publish'
  | 'event.cancel'
  | 'event.bootstrap'
  | 'user.suspend'
  | 'user.activate'
  | 'ticket.redeem'
  | 'ticket.cancel';

export async function audit(
  params: {
    actorUserId: string | null; // null = system action per spec §6
    action: AuditAction | string; // string for forward-compat with phase-specific actions
    target: string; // e.g. 'event:42', 'user:abc-123'
    meta?: Record<string, unknown>;
  },
  db: AuditDb = defaultDb,
): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: params.actorUserId,
    action: params.action,
    target: params.target,
    meta: params.meta ?? {},
  });
}
```

The optional `db` parameter is the minimal change to make `audit()` exercisable from tests. Production code paths in Phase 1+ continue to call `audit({...})` without the second arg — `defaultDb` is the Neon HTTP client.

REQ-audit-log SC#4; T-0-08 (centralised audit path); Blocker #1 (helper now testable in this phase).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && grep -q "import 'server-only'" src/lib/audit.ts && grep -q "export async function audit" src/lib/audit.ts</automated>
  </verify>
  <done>`audit()` exported; `'server-only'` first import; `pnpm tsc --noEmit` passes</done>
</task>

<task type="auto" tdd="true">
  <name>T-19: Write src/lib/ratelimit.ts (Upstash rate-limit instances)</name>
  <files>src/lib/ratelimit.ts</files>
  <behavior>
    - Two named exports: `magicLinkLimit` (10/60s sliding window, used Phase 1) and `ticketRedeemLimit` (50/60s sliding window, used Phase 5)
    - Lazy Redis client (only constructed if env vars present); in dev/test without Upstash, exports a no-op fallback that always allows
  </behavior>
  <action>
Install: `pnpm add @upstash/ratelimit @upstash/redis`.

Create `src/lib/ratelimit.ts` per RESEARCH.md Code Examples + dev-fallback:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

// In dev/test without Upstash, return an always-allow stub.
// Production deploys MUST have UPSTASH_REDIS_REST_URL set (validated by env.ts in Phase 1+).
const NOOP_LIMIT = {
  limit: async () => ({ success: true, limit: Infinity, remaining: Infinity, reset: 0 }),
} as unknown as Ratelimit;

const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  : null;

export const magicLinkLimit: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),  // REQ-magic-link-auth: 10/min/IP
      analytics: true,
      prefix: 'rl:magiclink',
    })
  : NOOP_LIMIT;

export const ticketRedeemLimit: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '60 s'),  // REQ-qr-checkin-scanner: 50/min/venue
      analytics: true,
      prefix: 'rl:redeem',
    })
  : NOOP_LIMIT;
```

REQ-quality-bar (rate-limit primitive in place; concrete use Phase 1+).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && grep -q 'magicLinkLimit' src/lib/ratelimit.ts && grep -q 'ticketRedeemLimit' src/lib/ratelimit.ts</automated>
  </verify>
  <done>Both limits exported; dev-fallback in place; types compile</done>
</task>

<task type="auto" tdd="true">
  <name>T-20: Write tests/unit/audit.test.ts (testcontainers-backed)</name>
  <files>tests/unit/audit.test.ts</files>
  <behavior>
    - Spins up Postgres testcontainer (`postgres:16-alpine`) once per file
    - Runs `migrate()` against the container with the same `drizzle/` migration files used in production
    - Test 1 (helper exercised): `await audit({ actorUserId: null, action: 'event.bootstrap', target: 'event:test-1', meta: {...} }, ctx.db)` — calls the real `audit()` helper from `@/lib/audit`, passing the testcontainer client; row appears in `audit_log` with `actor_user_id IS NULL`
    - Test 2 (helper exercised): `await audit({ actorUserId: <uuid>, action: 'user.suspend', target: 'user:42', meta: { reason: 'spam' } }, ctx.db)` — row has correct action/target/meta
    - Test 3 (CHECK proof): inserting `events.capacity = 0` raises a CHECK violation (proves T-14's CHECK is live)
    - Test 4 (CHECK proof): inserting `events.status='published'` with `artistAck=false` raises CHECK violation
    - Test 5 (UNIQUE proof): inserting two `tickets` with same `(eventId, userId)` raises unique violation
    - Tests run sequentially per Pitfall 7 (vitest.config.ts already has `sequence.concurrent: false`)
    - **Tests 1 & 2 prove REQ-audit-log SC#4 ("audit helper unit-tested") — the helper itself is now exercised, not bypassed (Blocker #1 fix)**
  </behavior>
  <action>
Create `tests/unit/audit.test.ts` extending RESEARCH.md Code Examples. **Tests 1 & 2 call the real `audit()` helper** (passing the testcontainer client as the second arg, per T-18 dependency-injected signature) — this is the REQ-audit-log SC#4 proof. Tests 3-5 are schema-invariant proofs (raw inserts):

```typescript
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { startPgWithMigrations, stopPg, type TestContext } from '../setup/pg-container';
import { audit } from '@/lib/audit';
import * as schema from '@/db/schema';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startPgWithMigrations();
  // T-18 refactor: audit() accepts an optional db arg (defaults to Neon HTTP in prod).
  // Tests pass ctx.db (testcontainer pg client) so the helper writes against this container.
}, 60_000);

afterAll(async () => {
  await stopPg(ctx);
});

describe('audit() helper (REQ-audit-log SC#4)', () => {
  it('audit() with actorUserId=null writes a system-action row', async () => {
    await audit(
      {
        actorUserId: null,
        action: 'event.bootstrap',
        target: 'event:test-1',
        meta: { reason: 'cold-start seed' },
      },
      ctx.db,
    );
    const rows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(isNull(schema.auditLog.actorUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('event.bootstrap');
    expect(rows[0]!.target).toBe('event:test-1');
    expect(rows[0]!.meta).toEqual({ reason: 'cold-start seed' });
  });

  it('audit() with a real actor writes action/target/meta correctly', async () => {
    const [u] = await ctx.db
      .insert(schema.users)
      .values({ email: 'admin@example.com', role: 'admin' })
      .returning();
    await audit(
      {
        actorUserId: u!.id,
        action: 'user.suspend',
        target: 'user:42',
        meta: { reason: 'spam' },
      },
      ctx.db,
    );
    const rows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'user.suspend'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorUserId).toBe(u!.id);
    expect(rows[0]!.target).toBe('user:42');
    expect(rows[0]!.meta).toEqual({ reason: 'spam' });
  });
});

describe('schema invariants', () => {
  it('events.capacity > 0 CHECK rejects 0', async () => {
    // Need a user row first (FK)
    const [u] = await ctx.db.insert(schema.users).values({
      email: 'a@example.com', role: 'artist',
    }).returning();
    const [v] = await ctx.db.insert(schema.users).values({
      email: 'v@example.com', role: 'venue',
    }).returning();

    await expect(
      ctx.db.insert(schema.events).values({
        artistId: u!.id, venueId: v!.id,
        title: 'x', startAt: new Date(), capacity: 0,
      }),
    ).rejects.toThrow(/events_capacity_positive|capacity/);
  });

  it('events: status=published with artistAck=false fails the bilateral CHECK', async () => {
    const [u] = await ctx.db.insert(schema.users).values({
      email: 'a2@example.com', role: 'artist',
    }).returning();
    const [v] = await ctx.db.insert(schema.users).values({
      email: 'v2@example.com', role: 'venue',
    }).returning();

    await expect(
      ctx.db.insert(schema.events).values({
        artistId: u!.id, venueId: v!.id,
        title: 'y', startAt: new Date(), capacity: 50,
        status: 'published', artistAck: false, venueAck: true,
      }),
    ).rejects.toThrow(/events_published_iff_both_ack|published/);
  });

  it('tickets UNIQUE(eventId, userId) rejects duplicate', async () => {
    const [u] = await ctx.db.insert(schema.users).values({
      email: 'a3@example.com', role: 'artist',
    }).returning();
    const [v] = await ctx.db.insert(schema.users).values({
      email: 'v3@example.com', role: 'venue',
    }).returning();
    const [r] = await ctx.db.insert(schema.users).values({
      email: 'r@example.com', role: 'public',
    }).returning();
    const [e] = await ctx.db.insert(schema.events).values({
      artistId: u!.id, venueId: v!.id,
      title: 'z', startAt: new Date(), capacity: 10,
    }).returning();

    await ctx.db.insert(schema.tickets).values({
      eventId: e!.id, userId: r!.id, qrHash: 'aaaa1111bbbb2222ccc33',
    });

    await expect(
      ctx.db.insert(schema.tickets).values({
        eventId: e!.id, userId: r!.id, qrHash: 'dddd4444eeee5555fff66',
      }),
    ).rejects.toThrow(/tickets_event_user_uq|duplicate/);
  });
});
```

REQ-audit-log acceptance #4; CON-data-model invariants proven.
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/audit.test.ts</automated>
  </verify>
  <done>All 5 tests pass (2 audit-helper + 3 schema-invariant); testcontainer starts/stops cleanly; ~60-90s runtime; REQ-audit-log SC#4 satisfied (helper exercised in-phase, not deferred)</done>
</task>

<task type="auto" tdd="true">
  <name>T-21: Write src/components/cookie-banner.tsx (vanilla-cookieconsent, DE)</name>
  <files>src/components/cookie-banner.tsx, src/app/globals.css</files>
  <behavior>
    - Banner mounts client-side only (`'use client'`)
    - DE locale, no analytics category — only "necessary" (session cookies for auth)
    - Renders on first visit; on accept, hides and persists choice in localStorage
    - No FOUC per Pitfall 5: dynamic import + `return null` server render + CSS class hides during hydration
  </behavior>
  <action>
Install: `pnpm add vanilla-cookieconsent@latest`.

Create `src/components/cookie-banner.tsx` per RESEARCH.md Code Examples (DE-only, necessary-only):
```typescript
'use client';
import { useEffect } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

export function CookieBanner() {
  useEffect(() => {
    let active = true;
    (async () => {
      const CC = await import('vanilla-cookieconsent');
      if (!active) return;
      CC.run({
        guiOptions: {
          consentModal: { layout: 'box', position: 'bottom right' },
          preferencesModal: { layout: 'box' },
        },
        categories: {
          necessary: { enabled: true, readOnly: true },
        },
        language: {
          default: 'de',
          translations: {
            de: {
              consentModal: {
                title: 'Wir respektieren deine Privatsphäre',
                description:
                  'Diese Seite verwendet ausschließlich technisch notwendige Cookies (Session-Login). Keine Tracking-Cookies, keine Analytics.',
                acceptAllBtn: 'Verstanden',
                showPreferencesBtn: 'Einstellungen',
              },
              preferencesModal: {
                title: 'Cookie-Einstellungen',
                acceptAllBtn: 'Alle akzeptieren',
                savePreferencesBtn: 'Auswahl speichern',
                closeIconLabel: 'Schließen',
                sections: [
                  {
                    title: 'Technisch notwendig',
                    description: 'Erforderlich für Login und Session-Management.',
                    linkedCategory: 'necessary',
                  },
                ],
              },
            },
          },
        },
      });
    })();
    return () => { active = false; };
  }, []);
  return null;
}
```

Append to `src/app/globals.css` (Tailwind 4 entry — preserve `@import` from create-next-app):
```css
/* Cookie banner: avoid FOUC on first paint. Banner is shown by JS once consent state is read. */
.cc--anim { transition: opacity 200ms; }
```

REQ-quality-bar (GDPR cookie banner from day 1, DE locale per DEC-006). T-0-04 mitigation.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && grep -q "'use client'" src/components/cookie-banner.tsx && grep -q "default: 'de'" src/components/cookie-banner.tsx</automated>
  </verify>
  <done>Component compiles; DE locale set; only `necessary` category enabled (no analytics)</done>
</task>

<task type="auto" tdd="true">
  <name>T-22: Write src/app/layout.tsx + src/app/page.tsx (placeholder landing)</name>
  <files>src/app/layout.tsx, src/app/page.tsx</files>
  <behavior>
    - `<html lang="de">` per DEC-006 (DE only)
    - Meta: title "Cultural Layer Recklinghausen", description in DE
    - `<CookieBanner />` mounted at end of `<body>` (after content for natural focus order)
    - Landing page is intentionally minimal: site name + tagline + cookie banner. No images, no tracking, no third-party scripts. Optimised for Lighthouse ≥ 90 + axe zero violations.
    - Server Component (no `'use client'` on layout/page)
    - All interactive elements have visible focus rings (Tailwind `focus-visible:ring-2`); contrast ≥ 4.5:1
  </behavior>
  <action>
Replace the create-next-app placeholders with our minimal a11y-first landing.

`src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import { CookieBanner } from '@/components/cookie-banner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cultural Layer Recklinghausen',
  description:
    'Bilaterale Event-Plattform für Künstler:innen und Locations im Kreis Recklinghausen.',
  metadataBase: new URL('https://example.vercel.app'), // Phase 6 swaps to real domain
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:rounded focus-visible:bg-black focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
        >
          Zum Inhalt springen
        </a>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:
```typescript
export default function Page() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        Cultural Layer Recklinghausen
      </h1>
      <p className="text-lg text-neutral-700">
        Eine bilaterale Event-Plattform für Künstler:innen und Locations im Kreis Recklinghausen — bald verfügbar.
      </p>
    </main>
  );
}
```

Now create the landing e2e test in `tests/e2e/landing.spec.ts` per RESEARCH.md Code Examples + cookie-banner check:
```typescript
import { test, expect } from './fixtures';

test('/ renders site title and tagline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Cultural Layer Recklinghausen');
  await expect(page.locator('main')).toContainText('bald verfügbar');
});

test('/ has zero WCAG 2.1 AA violations', async ({ page, makeAxeBuilder }) => {
  await page.goto('/');
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});

test('/ shows the GDPR cookie banner in German', async ({ page }) => {
  await page.goto('/');
  // vanilla-cookieconsent renders the modal lazily; wait for it
  await expect(page.locator('[data-cc="consent-modal"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-cc="consent-modal"]')).toContainText('Wir respektieren');
  await expect(page.locator('[data-cc="consent-modal"]')).toContainText('Verstanden');
});

test('/ has lang=de on html element (DEC-006)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
```

REQ-quality-bar (Lighthouse, a11y, GDPR banner); DEC-006 (DE only); DEC-016 (a11y-first markup base).
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint && pnpm playwright test tests/e2e/landing.spec.ts --project=chromium</automated>
  </verify>
  <done>All 4 e2e tests pass against `pnpm dev`; landing renders site name + DE tagline; cookie banner visible in DE</done>
</task>

<!-- ====================================================================== -->
<!-- WAVE 2 — VERCEL + NEON + SENTRY + BETTER AUTH + DEPLOY (T-23 .. T-34)   -->
<!-- ====================================================================== -->

<task type="checkpoint:human-action" gate="blocking">
  <name>T-23: Vercel link + Neon Marketplace integration (manual)</name>
  <what-built>Two manual steps that have no Claude-runnable equivalent: (a) `vercel link` is interactive (asks for scope/project); (b) Neon Marketplace integration is a UI-only flow.</what-built>
  <how-to-verify>
    1. Run from repo root: `vercel link`
       - Pick or create scope (Hobby account is fine)
       - Project name: `cultural-layer-recklinghausen`
       - Confirm; this writes `.vercel/project.json` (already gitignored via T-03)
    2. Visit https://vercel.com/dashboard, open the project, go to Storage tab
    3. Click "Connect Database" → choose "Neon" from Marketplace → confirm region (Frankfurt — fra1, closest to Ruhr) → name the DB `cultural-layer-prod`
    4. After Neon provisioning completes, Vercel auto-injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` into all three environments (Development, Preview, Production)
    5. Pull dev env locally: `vercel env pull .env.local --environment=development`
    6. Verify: `head -3 .env.local` shows `DATABASE_URL=postgres://...neon.tech/...`
    7. Reply with "vercel linked + neon provisioned"
  </how-to-verify>
  <resume-signal>Type "vercel linked + neon provisioned" or paste any error</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>T-24: Provision Vercel Blob + Upstash Redis stores (manual)</name>
  <what-built>Both are Vercel Marketplace UI flows that auto-inject env vars.</what-built>
  <how-to-verify>
    **Vercel Blob:**
    1. Vercel Project → Storage → "Create" → "Blob" → name `cultural-layer-blob`
    2. Auto-injects `BLOB_READ_WRITE_TOKEN` to all 3 environments

    **Upstash Redis (via Vercel Marketplace):**
    1. Vercel Project → Storage → "Connect Database" → "Upstash" → "KV (Redis)" → region `eu-west-1`
    2. Name: `cultural-layer-ratelimit`
    3. Auto-injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

    Pull again to local: `vercel env pull .env.local --environment=development`

    Verify with: `grep -E '^(BLOB_READ_WRITE_TOKEN|UPSTASH_REDIS_REST_URL)=' .env.local` returns both lines.

    Reply with "blob + upstash provisioned"
  </how-to-verify>
  <resume-signal>Type "blob + upstash provisioned" or describe issue</resume-signal>
</task>

<task type="auto">
  <name>T-25: Wire Better Auth (instance + magicLink+Resend + Drizzle adapter + route handler)</name>
  <files>src/lib/auth.ts, src/lib/auth-client.ts, src/app/api/auth/[...all]/route.ts, src/db/auth-schema.ts, tests/integration/better-auth-smoke.test.ts</files>
  <action>
Install: `pnpm add better-auth@1.6.9 resend@6.12.2`.

**Step 1 — Generate Better Auth SQL + Drizzle types.** The `@better-auth/cli` writes a SQL migration into `drizzle/` AND prints the equivalent Drizzle `pgTable` declarations we need to feed into the adapter at runtime:

```bash
npx @better-auth/cli@latest generate --output drizzle/0001_better_auth.sql
```

Inspect `drizzle/0001_better_auth.sql` — confirms 4 `CREATE TABLE` statements: `user`, `session`, `account`, `verification`.

**Step 2 — Declare Better Auth tables in Drizzle for the adapter.** Better Auth's Drizzle adapter requires the schema object to be passed at runtime so it can resolve typed columns. Create `src/db/auth-schema.ts` with `pgTable` declarations matching the SQL above (Better Auth v1.6 publishes a reference schema in its docs; mirror it here):

```typescript
// src/db/auth-schema.ts — Better Auth tables (managed by @better-auth/cli SQL).
// These pgTable declarations exist purely so `drizzleAdapter(db, { schema: { user, ... } })` is type-safe.
// SHAPE MUST MATCH drizzle/0001_better_auth.sql exactly. Re-run `@better-auth/cli generate` if Better Auth ever bumps the table shape and update both files together.
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// If `npx @better-auth/cli generate` produces a different shape (e.g. additional columns in a future Better Auth release),
// re-paste from the CLI output and re-run `pnpm db:migrate`. Drift between this file and the SQL = runtime adapter errors.
```

**Step 3 — Apply the migration:**
```bash
pnpm db:migrate
```

**Step 4 — `src/lib/auth.ts`** per RESEARCH.md Pattern 3, **with `schema:` passed to the adapter and a minimal signup hook for Pitfall 6 / Threat T-0-07** (FK Better Auth `user.id` to a domain `users` row created on first sign-up):

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from '@/db';
import { env } from '@/lib/env';
import * as authSchema from '@/db/auth-schema';
import { users as domainUsers } from '@/db/schema';
import { audit } from '@/lib/audit';

const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
  appName: 'Cultural Layer Recklinghausen',
  // Adapter requires the explicit schema object — without it, Better Auth falls back to introspection and breaks under strict TS.
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
    },
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // Pitfall 6 / T-0-07 mitigation: when Better Auth provisions a new `user` row, mirror to our domain `users` table.
  // Phase 0 hook is intentionally minimal (default role = 'public', no admin escalation).
  // Phase 1 will exercise this hook against the real magic-link UI and add invite-based role assignment.
  databaseHooks: {
    user: {
      create: {
        after: async (createdAuthUser) => {
          // Create or attach a domain users row keyed off Better Auth user.id.
          // Use Better Auth's text id directly as the domain users.id (cast/keep — Phase 1 may switch to uuid bridge table if collision-resistant casting becomes painful).
          await db
            .insert(domainUsers)
            .values({
              // domainUsers.id is uuid with defaultRandom() — for now we let Postgres assign it; the bridge is `email` + audit trail.
              email: createdAuthUser.email,
              role: 'public',
              status: 'active',
            })
            .onConflictDoNothing({ target: domainUsers.email });
          // Audit the bootstrap so we can trace bridge events post-Phase-1.
          await audit({
            actorUserId: null,
            action: 'event.bootstrap', // re-using a generic bootstrap action; Phase 1 may add 'user.create' to AuditAction
            target: `auth-user:${createdAuthUser.id}`,
            meta: { email: createdAuthUser.email, source: 'better-auth.databaseHooks.user.create' },
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,  // 15 min — REQ-magic-link-auth (Phase 1 acceptance)
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: 'Cultural Layer <onboarding@resend.dev>', // Phase 6: swap to verified domain
          to: email,
          subject: 'Dein Login-Link',
          html: `<p>Klicke hier, um dich anzumelden: <a href="${url}">${url}</a></p>
                 <p>Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.</p>`,
        });
      },
    }),
  ],
});
```

**Step 5 — `src/lib/auth-client.ts`** (browser side):
```typescript
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  plugins: [magicLinkClient()],
});
```

**Step 6 — `src/app/api/auth/[...all]/route.ts`:**
```typescript
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 7 — Smoke test the auth instance compiles AND boots without throwing.** Create `tests/integration/better-auth-smoke.test.ts` (Vitest, node env, no testcontainer needed — only confirms the wiring resolves at module load + an unauthenticated `getSession` returns null cleanly):

```typescript
// @vitest-environment node
// Smoke test: Better Auth instance constructs and `getSession` returns null without throwing.
// This proves the schema-binding (Step 2) and Drizzle adapter wiring (Step 4) actually work at runtime,
// not just at typecheck time. If the adapter is misconfigured (missing schema, FK mismatch), this test crashes.
import { describe, it, expect } from 'vitest';
import { auth } from '@/lib/auth';

describe('Better Auth wiring (Blocker #3 smoke)', () => {
  it('imports `auth` and exposes the api surface', () => {
    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.getSession).toBe('function');
  });

  it('getSession with empty headers returns null without throwing', async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });
});
```

This smoke test runs against the **dev** Neon DB (DATABASE_URL from `.env.local`). It does NOT use testcontainers — Better Auth's adapter is the integration we want to prove, and it needs a real connection where the 4 Better Auth tables already exist (after Step 3). Phase 1 will replace this with a full magic-link e2e flow.

DEC-008 + DEC-014; Pitfall 6 + Threat T-0-07 (real code, not just docs — Blocker #3 fix); REQ-magic-link-auth foundations (Phase 1 wires the UI).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && test -f src/db/auth-schema.ts && test -f src/app/api/auth/\[...all\]/route.ts && grep -q 'toNextJsHandler' src/app/api/auth/\[...all\]/route.ts && grep -q "databaseHooks" src/lib/auth.ts && grep -q "schema:" src/lib/auth.ts && pnpm vitest run tests/integration/better-auth-smoke.test.ts</automated>
  </verify>
  <done>Better Auth instance compiles; magicLink+Resend wired; route handler exports GET/POST; `src/db/auth-schema.ts` declares all 4 Better Auth tables; adapter passed `schema: {...}` explicitly; signup hook wired to bridge to domain `users` table (Pitfall 6 / T-0-07 mitigation); Better Auth tables present in Neon (`psql ... \dt user session account verification`); smoke test (`tests/integration/better-auth-smoke.test.ts`) passes — unauthenticated `getSession` returns null without throwing</done>
</task>

<task type="auto">
  <name>T-26: Write src/app/api/_test-sentry/route.ts (debug error endpoint)</name>
  <files>src/app/api/_test-sentry/route.ts</files>
  <action>
Create the gated debug route used to prove Sentry → Telegram routing (REQ-quality-bar SC#3).

```typescript
// src/app/api/_test-sentry/route.ts
// DEBUG ONLY — Phase 0 verification of Sentry pipeline. Disable post-Phase-0 (set ENABLE_TEST_SENTRY=false in prod).
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  // Gate 1: env flag
  if (env.ENABLE_TEST_SENTRY !== 'true') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  // Gate 2: token query param (T-0-05 SSRF/spam mitigation)
  const token = req.nextUrl.searchParams.get('token');
  if (!env.DEBUG_TOKEN || token !== env.DEBUG_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Throw a deliberately-shaped error Sentry will tag as P1
  throw new Error('SENTRY_SMOKE_TEST: deliberate Phase 0 verification error');
}
```

After T-32 verification confirms the Sentry → Telegram round-trip works, set `ENABLE_TEST_SENTRY=false` in Vercel prod ENV. The route then returns 404 in production. T-0-05 mitigated by both env-flag AND token gate.

REQ-quality-bar SC#3.
  </action>
  <verify>
    <automated>pnpm typecheck && grep -q 'SENTRY_SMOKE_TEST' src/app/api/_test-sentry/route.ts && grep -q 'ENABLE_TEST_SENTRY' src/app/api/_test-sentry/route.ts</automated>
  </verify>
  <done>Route exists; double-gated (env flag + token); throws Error with identifiable message</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>T-27: Run Sentry wizard + install Telegram Alerts integration (manual)</name>
  <what-built>Wizard generates 4 files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`) and wraps `next.config.ts` with `withSentryConfig`. Telegram integration is a Sentry org UI flow.</what-built>
  <how-to-verify>
    1. Run: `pnpm dlx @sentry/wizard@latest -i nextjs`
       - When prompted: "Sentry Cloud" → log in via browser
       - Pick org (or create one named like `cultural-layer`)
       - Pick or create project: `cultural-layer-recklinghausen` (Next.js platform)
       - Wizard generates `sentry.{client,server,edge}.config.ts`, `instrumentation.ts`, edits `next.config.ts`
       - Wizard adds `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` instructions
    2. Add the 4 Sentry env vars to Vercel (all 3 environments):
       ```
       vercel env add SENTRY_DSN          # paste from Sentry project settings
       vercel env add SENTRY_AUTH_TOKEN   # paste from Sentry user settings → auth tokens
       vercel env add SENTRY_ORG          # the org slug
       vercel env add SENTRY_PROJECT      # cultural-layer-recklinghausen
       ```
       For each, when prompted "Apply to which environments?" select all of: Production, Preview, Development.
    3. Add same 4 to GitHub Actions repo secrets (Settings → Secrets and variables → Actions):
       - `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
    4. **Telegram integration** — Sentry → Settings → Integrations → search "Telegram" → install "Telegram Alerts Bot" (org owner permission required). Follow OAuth bridge to your Telegram bot/channel.
    5. Create alert rule: Sentry project → Alerts → "Create Alert" → condition: `event.level == 'error'` → action: notify Telegram channel `#recklinghausen-p1`
    6. Pull updated env back: `vercel env pull .env.local --environment=development`
    7. Reply with "sentry wizard + telegram done"
  </how-to-verify>
  <resume-signal>Type "sentry wizard + telegram done" or describe what failed</resume-signal>
</task>

<task type="auto">
  <name>T-28: Verify next.config.ts wraps withSentryConfig + add vercel.json (Fluid Compute pin)</name>
  <files>next.config.ts, vercel.json</files>
  <action>
**Inspect** `next.config.ts` (modified by Sentry wizard in T-27). It should look like:
```typescript
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // create-next-app defaults; add explicit:
  images: {
    remotePatterns: [
      // Phase 1 will add Vercel Blob hosts; placeholder OK now
    ],
  },
  // Per RESEARCH.md State of the Art: cacheComponents replaces dynamicIO; opt-in for p95<2s
  experimental: {
    cacheComponents: true,  // foundation for REQ-quality-bar p95 < 2s
  },
};

export default withSentryConfig(nextConfig, {
  // Wizard-generated; inspect and confirm:
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
```

If the wizard did NOT add `cacheComponents: true`, add it manually now. (Foundation for p95 < 2s NFR — actual perf is measured in T-32.)

**Create `vercel.json`** to lock Fluid Compute + Node 24 + 300s timeout per DEC-021:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "functions": {
    "src/app/api/**/*.ts": {
      "runtime": "nodejs24.x",
      "maxDuration": 300
    }
  }
}
```

Note: Vercel auto-detects Next.js so most fields are optional. The `functions` block is the safety net per A7 (defaults could change).

DEC-021 (Fluid Compute, Node 24, 300s); DEC-022 (no Edge runtime).
  </action>
  <verify>
    <automated>grep -q 'withSentryConfig' next.config.ts && grep -q 'cacheComponents' next.config.ts && grep -q 'nodejs24' vercel.json</automated>
  </verify>
  <done>next.config.ts wrapped with `withSentryConfig`; `cacheComponents: true`; `vercel.json` locks Node 24 + 300s</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>T-29: Set Vercel ENV vars (separate dev/preview/prod) + GitHub secrets (manual)</name>
  <what-built>REQ-quality-bar SC#6: Vercel ENV separation. The dashboard / `vercel env add` is the only authoritative store; never echo to logs.</what-built>
  <how-to-verify>
    For each of the following, run `vercel env add VAR_NAME` and when asked, paste a fresh value AND select Production/Preview/Development separately so each environment gets a DISTINCT value (where appropriate; some vars like `BETTER_AUTH_SECRET` may stay the same per env, but Resend/Upstash should be separate Resend keys / Upstash DBs ideally):

    **Mandatory distinct-per-env (the spirit of REQ-quality-bar SC#6):**
    - `BETTER_AUTH_SECRET` — generate 3 cryptorandom 32-char strings: `openssl rand -hex 32` × 3
    - `BETTER_AUTH_URL` — Production: `https://<your-project>.vercel.app`; Preview: leave Vercel-managed `VERCEL_URL`; Development: `http://localhost:3000`
    - `RESEND_API_KEY` — same key acceptable in v1 (single Resend project), but flag for split when domain is verified in Phase 6
    - `DEBUG_TOKEN` — Phase 0 only: `openssl rand -hex 32`
    - `ENABLE_TEST_SENTRY` — Production: `false`; Preview: `true`; Development: `true`
    - `ENABLE_BOOTSTRAP` — set to `false` in all (Phase 7 enables on demand)
    - `ADMIN_EMAIL` — your real email

    **Auto-injected (skip — already done by Marketplace):**
    - DATABASE_URL, DATABASE_URL_UNPOOLED (Neon)
    - BLOB_READ_WRITE_TOKEN (Blob)
    - UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (Upstash)
    - SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT (Sentry wizard)

    **GitHub Actions repo secrets (Settings → Secrets and variables → Actions → New repository secret):**
    - `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (mirror of Vercel)
    - `VERCEL_AUTOMATION_BYPASS_SECRET` — get from Vercel Project → Settings → Deployment Protection → Bypass Token

    **Verify:**
    - `vercel env ls preview` and `vercel env ls production` show all required vars
    - `vercel env pull .env.local --environment=development` updates `.env.local` with all values
    - `pnpm tsc --noEmit` succeeds (env.ts parses)
    - Reply with "vercel env separated + github secrets set"
  </how-to-verify>
  <resume-signal>Type "vercel env separated + github secrets set" or describe what's missing</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>T-30: Configure GitHub branch protection on main (manual)</name>
  <what-built>REQ-quality-bar CI gate: typecheck + lint + vitest + e2e (playwright) MUST pass to merge to main. Branch protection is GitHub-UI only (gh api works but is brittle).</what-built>
  <how-to-verify>
    1. Push the repo to GitHub: `git push -u origin main` (assumes `gh repo create` was done; if not, run `gh repo create cultural-layer-recklinghausen --private --source=. --push`)
    2. GitHub → repo → Settings → Branches → "Add rule" or "Add branch protection rule"
    3. Branch name pattern: `main`
    4. Enable: "Require a pull request before merging"
    5. Enable: "Require status checks to pass before merging"
    6. Search and add status checks (these names match `.github/workflows/ci.yml` job IDs):
       - `typecheck`
       - `lint`
       - `vitest`
       - `secret-scan`
       - `playwright` (from e2e.yml — appears after first preview deploy)
    7. Enable: "Require conversation resolution before merging" (good hygiene)
    8. Save
    9. Verify by opening a draft PR with a deliberate `tsc` failure and confirming the merge button is disabled. (You can do this on a throwaway branch later — not required for sign-off here.)
    10. Reply with "branch protection enabled on main"
  </how-to-verify>
  <resume-signal>Type "branch protection enabled on main" or paste the rule screenshot/list</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>T-31: Toggle Vercel "Stage and manually promote" production gate (manual)</name>
  <what-built>DEC-020 + REQ-quality-bar SC#1: production deploy must require explicit human promotion, not auto-promote on push to main.</what-built>
  <how-to-verify>
    1. Vercel Dashboard → Project → Settings → Deployment Protection
    2. Under "Production Deployments" find the toggle: **"Stage and manually promote production deployments"** → enable
    3. Save
    4. (Verification at T-32: pushing to main produces a Staged deployment, NOT a promoted one.)
    5. Reply with "manual promote toggle ON"
  </how-to-verify>
  <resume-signal>Type "manual promote toggle ON"</resume-signal>
</task>

<task type="auto">
  <name>T-32: First deploy + end-to-end smoke (CI + preview + Sentry round-trip)</name>
  <files>(no new files; uses pushed commits + deployed preview)</files>
  <action>
Final wave verification — ties together every prior task into a green deploy.

1. **Commit all Wave 0/1/2 changes** to a feature branch (e.g. `phase-0-skeleton`):
   ```bash
   git checkout -b phase-0-skeleton
   git add -A
   git commit -m "phase(00): skeleton & infra — full stack scaffold (REQ-quality-bar, REQ-audit-log)"
   git push -u origin phase-0-skeleton
   ```
2. **Open PR against main** via `gh pr create --title "Phase 0: Skeleton & Infra" --body "Closes infra setup per .planning/phases/00-skeleton-infra/00-PLAN.md"`
3. **Wait for CI to run** — typecheck/lint/vitest/secret-scan should all turn green within ~3 min. If any red, fix and push.
4. **Vercel auto-deploys a preview** — wait for `deployment_status` event, which triggers `e2e.yml` and `lighthouse.yml`. Both should turn green within ~10 min.
5. **Confirm "Staged" badge** — in Vercel project deployments, the new push to main (after PR merge) shows "Staged" not "Promoted to Production" → DEC-020 verified.
6. **Sentry round-trip smoke test** — once preview is live:
   ```bash
   PREVIEW_URL=$(vercel inspect --url $(gh pr view phase-0-skeleton --json deployments --jq '.deployments[0].url'))
   DEBUG_TOKEN=$(grep DEBUG_TOKEN .env.local | cut -d= -f2)
   curl "$PREVIEW_URL/api/_test-sentry?token=$DEBUG_TOKEN"
   ```
   Expect: HTTP 500 with the deliberate error. Within 60 seconds, check Sentry → Issues. The error `SENTRY_SMOKE_TEST: deliberate Phase 0 verification error` should appear with a Telegram notification in the configured channel.
7. **Lighthouse + axe results** — `lighthouse.yml` artifact (now using `preset: mobile` per Warning #4 fix) should show: Performance ≥ 0.9, Accessibility ≥ 0.9 on `/` **at mobile-class throttling**. axe (via `tests/e2e/landing.spec.ts`) shows 0 violations. If mobile perf < 0.9 on first preview, optimise T-22 landing (preload hero font, ensure no offscreen content, add `Cache-Control: public, max-age=300, s-maxage=3600` header on `/`) — Phase 0 should not require heavy perf work since landing is text-only.
8. **After verification:** flip `ENABLE_TEST_SENTRY=false` in Production env, redeploy preview, confirm `/api/_test-sentry?token=...` returns 404 in prod (T-0-05 closure).
9. **Promote to production** (manually, per DEC-020): Vercel dashboard → Deployments → "Promote to Production" on the green build. Confirm prod URL responds.

Capture each green state as evidence in the PR description for downstream verification.

REQ-quality-bar SC#1, SC#3, SC#5; REQ-audit-log full pipeline; ties together Wave 0 + 1 + 2.
  </action>
  <verify>
    <automated>gh pr checks phase-0-skeleton 2>&1 | grep -E '(typecheck|lint|vitest|secret-scan|playwright).*pass' | wc -l | awk '{ if ($1 < 5) exit 1 }'</automated>
  </verify>
  <done>All 5 CI checks (typecheck/lint/vitest/secret-scan/playwright — matching T-30 branch protection contract) green on PR; lighthouse.yml workflow green at mobile preset; preview deployed; staged-not-promoted confirmed; Sentry-Telegram round-trip proven; Lighthouse Mobile perf+a11y ≥ 0.9; axe 0 violations; production manually promoted</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>T-33: Write docs/runbook.md + final human verification</name>
  <what-built>A persisted runbook documenting the deployment, monitoring, and secret-rotation procedures for future-Jakob (months from now). Then human verifies the production deploy is live, banner is in DE, Sentry receives an error, no auto-promote happens, and audit table is queryable.</what-built>
  <how-to-verify>
    **First, Claude (this task type allows file writes during the human-verify wait):** create `docs/runbook.md` with at least these sections:
    - **External services** (one para each): Vercel project URL, Neon dashboard link, Sentry project URL, Resend dashboard, Upstash console
    - **Secret rotation procedure** for each of: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `SENTRY_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_TOKEN` (steps: rotate at provider, `vercel env rm` + `vercel env add`, redeploy)
    - **Deployment promotion** procedure (Vercel dashboard → Deployments → Promote button; reference DEC-020)
    - **Sentry → Telegram** alert rule explanation + how to test (curl `/api/_test-sentry?token=...` after re-enabling `ENABLE_TEST_SENTRY` temporarily)
    - **Branch protection** rule explanation + status check names
    - **Schema migration** procedure: `pnpm db:generate` (write SQL), inspect, commit, `pnpm db:migrate` (apply), or via CI step (Phase 1 may add a CI migrate step)
    - **PII / GDPR** notes per T-0-02: audit_log doesn't store IP/UA in v1; if Phase 7 adds them, document retention policy
    - **Cold-start gate** (CON-cold-start-operational): `ENABLE_BOOTSTRAP=true` enables `/admin/events/new` (Phase 7); 8-week cron alert lives in Phase 7

    **Then, USER manually verifies:**
    1. Visit the **production** URL (after T-32 promote): page loads in DE, h1 is "Cultural Layer Recklinghausen", cookie banner shows in DE, banner copy reads "Wir respektieren deine Privatsphäre"
    2. Open browser DevTools → Application → Cookies → confirm NO analytics cookies are set before clicking "Verstanden"
    3. Open `https://<prod-url>/api/_test-sentry?token=<DEBUG_TOKEN>` (USE the prod token from Vercel env) — should return 404 (gate is OFF in prod per T-32 step 9)
    4. From `psql $DATABASE_URL`: run `SELECT count(*) FROM audit_log;` — should be queryable (count is 0 or whatever testcontainers test left, depending on if you ran against prod-DB by mistake)
    5. Check Sentry dashboard → Issues — the smoke test error from T-32 step 6 should be present
    6. Check Telegram — the alert should have been delivered to the configured channel
    7. Run `gh pr checks phase-0-skeleton` again to confirm all status checks (typecheck, lint, vitest, secret-scan, playwright, lighthouse) are green

    Reply with "phase 0 verified" or list any FAIL items.
  </how-to-verify>
  <resume-signal>Type "phase 0 verified" or list any FAIL items in numbered format</resume-signal>
</task>

<task type="auto">
  <name>T-34: Update STATE.md + ROADMAP.md to mark Phase 0 complete</name>
  <files>.planning/STATE.md, .planning/ROADMAP.md</files>
  <action>
Edit `.planning/STATE.md`:
- Update "Current Position" → Phase: 1 of 7 (Auth & Profiles); Plan: 0 of TBD; Last activity: today's date with note "Phase 0 complete — skeleton deployed"
- Update Performance Metrics — add Phase 0 row with task count
- Move STATE.md "Blockers/Concerns" entries that are now resolved (Vercel CLI upgrade T-00, Vercel Marketplace T-23) to a "Resolved" sub-section or delete
- Add to "Decisions" recent-decisions list any choices made during Phase 0 (e.g. "Resend From: onboarding@resend.dev for Phase 0; switch to verified domain in Phase 6")

Edit `.planning/ROADMAP.md`:
- Phase 0 entry: change `- [ ]` to `- [x]` and update "Plans Complete" cell to `1/1`, "Status" to `Complete`, "Completed" to today's date in the Progress table
- Phase 0 detail: change `**Plans**: TBD` to `**Plans**: 1 plan (00-01-PLAN.md — single-file phase plan)`

These edits keep STATE/ROADMAP truthful for the next planner invocation (`/gsd-plan-phase 1`).
  </action>
  <verify>
    <automated>grep -q 'Phase 0 complete' .planning/STATE.md && grep -E '\- \[x\] \*\*Phase 0' .planning/ROADMAP.md</automated>
  </verify>
  <done>STATE.md cursor at Phase 1; ROADMAP.md Phase 0 ticked + plan filled in; commit message: `docs(00): phase 0 closed; advance state to phase 1`</done>
</task>

</tasks>

---

<verification>

## Phase-Level Verification (run before invoking `/gsd-verify-work`)

```bash
# 1. Local CI gate (matches GitHub Actions ci.yml)
pnpm typecheck && pnpm lint && pnpm test:unit

# 2. Schema reality check (10 domain tables + Better Auth tables)
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
# Expect: 10 domain + 4 better-auth = 14 tables

# 3. CHECKs / UNIQUEs / indexes inventory
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE contype='c' AND conrelid='events'::regclass;"
# Expect: events_capacity_positive, events_published_iff_both_ack
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_idx';"
# Expect: 8 day-1 indexes per CON-data-model

# 4. e2e against deployed preview
PLAYWRIGHT_TEST_BASE_URL="$PREVIEW_URL" pnpm test:e2e

# 5. Lighthouse mobile against preview
pnpm dlx @lhci/cli@latest autorun --collect.url="$PREVIEW_URL" --collect.settings.preset=mobile

# 6. Sentry round-trip (after temporarily re-enabling ENABLE_TEST_SENTRY)
curl "$PREVIEW_URL/api/_test-sentry?token=$DEBUG_TOKEN"
# Then visually confirm in Sentry within 60s + Telegram delivery

# 7. Audit helper unit test (testcontainers; ~60s)
pnpm vitest run tests/unit/audit.test.ts

# 8. PR status checks
gh pr checks phase-0-skeleton
```

</verification>

---

<success_criteria>

Mapped from ROADMAP.md Phase 0 success criteria:

| # | Success Criterion | Owning Tasks | Verification |
|---|-------------------|--------------|--------------|
| 1 | Push to main triggers GitHub Actions (typecheck + lint + Vitest + Playwright); merge blocked unless all 4 pass; successful merge produces a Vercel preview with manual gate to production | T-04, T-10, T-11, T-30, T-31, T-32 | `gh pr checks` green ≥ 4 jobs; "Staged" badge in Vercel after merge; manual Promote button works |
| 2 | 10-table Drizzle schema migrated to Neon with all CHECKs (`events.capacity > 0`, bilateral ACK), all UNIQUEs (tickets event-user, qrHash, magic_link tokenHash), all 8 day-1 indexes | T-14, T-16, T-17, T-20 | `psql ... \dt` shows 10 tables; `\d events` shows both CHECK constraints; `pg_indexes` query returns 8 `_idx` rows; testcontainers test proves CHECKs reject bad inserts |
| 3 | Deliberate error in any deployed route surfaces in Sentry within seconds + P1 Telegram alert | T-26, T-27, T-32 | `curl /api/_test-sentry?token=...` → Sentry issue + Telegram message within 60s |
| 4 | `audit()` helper exists, writes to `audit_log` (with `actorUserId=NULL` for system), unit-tested on Postgres testcontainers | T-18, T-20 | `pnpm vitest run tests/unit/audit.test.ts` passes 4 tests including the NULL-actor case |
| 5 | Placeholder landing at `/` passes Lighthouse Mobile ≥ 90, axe 0 WCAG 2.1 AA violations, GDPR cookie banner rendered | T-21, T-22, T-32 | `lighthouse.yml` workflow asserts 0.9; `tests/e2e/landing.spec.ts` axe test green; cookie banner test green; manual mobile-preset Lighthouse run ≥ 0.9 |
| 6 | Vercel Blob, Resend, Better Auth wired with secrets in Vercel ENV (separate dev/preview/prod), never in git | T-23, T-24, T-25, T-29, T-05 (gitleaks) | `vercel env ls` per env shows all required; `gitleaks-action` green on PR; `.env*` in `.gitignore`; husky pre-commit configured |

All 6 ROADMAP success criteria are owned by at least 2 tasks (no single point of failure for verification).

</success_criteria>

---

<open_questions>

Carried forward from RESEARCH.md `## Open Questions`. Resolutions per orchestrator's `<answers_to_open_questions>` block:

| # | Question | Resolution |
|---|----------|-----------|
| 1 | Domain name for Resend / production URL | **DEFERRED to Phase 6** (Email Notifications). Phase 0 uses `*.vercel.app` for URLs and `onboarding@resend.dev` as Resend From-address. Wired in T-25. |
| 2 | Vercel team / org tier | **Hobby is fine for Phase 0.** Re-evaluate at Phase 4 launch if function-invocation or bandwidth limits start biting. T-23 task. |
| 3 | Monorepo structure | **Confirmed: single Next.js project, no workspaces.** DEC-022 forbids Turbo monorepo. T-01 task. |
| 4 | Sentry organization (new vs existing) | **Existing personal org assumed.** If user has none, T-27 wizard prompts to create one. Documented in runbook (T-33). |
| 5 | Cron / scheduled functions wiring | **Phase 0 creates `vercel.json` (T-28) without `crons:` block.** Phase 2 (24h auto-completion) and Phase 7 (8-week bootstrap-flag check) append cron entries. |
| 6 | Branch strategy | **Single `main` + Vercel "Stage and manually promote" toggle.** Per RESEARCH.md Pattern 6 + STATE.md guidance. T-31 task enforces. No `release` branch introduced. |

**Newly identified during planning:**

| # | Question | Phase | Notes |
|---|----------|-------|-------|
| OQ-7 | Should `cacheComponents: true` be enabled in Phase 0 or wait until first cache-eligible page (Phase 4 public feed)? | Decided: **enable in Phase 0** (T-28). Foundation for p95 < 2s NFR; landing page is RSC-only so no surprise. If issues, Phase 1 can opt-out per route. |
| OQ-8 | UI-SPEC for landing | **SKIPPED per user choice.** Landing is logo + 1-line copy + cookie banner; no design-contract artefact needed. |
| OQ-9 | Better Auth tables — generate migration before or after our schema migration? | **After (T-25 runs after T-17).** Easier to reason about: our 10 first, then Better Auth's 4 in a follow-up `0001_better_auth.sql`. |

</open_questions>

---

<known_limitations>

Documented for future-Jakob and Phase-1+ planners:

1. ~~`tests/unit/audit.test.ts` directly inserts via `ctx.db`~~ — **RESOLVED in this phase (Blocker #1 fix).** T-18 now exports `audit(params, db?)` with an optional db arg; T-20 tests call `await audit({...}, ctx.db)` so REQ-audit-log SC#4 is satisfied in-phase, not deferred.

2. ~~`lighthouserc.json` runs `preset: desktop` in CI~~ — **RESOLVED in this phase (Warning #4 fix).** `lighthouserc.json` ships with `preset: mobile` from day 1. Placeholder landing must pass mobile ≥ 0.9 to merge.

3. **`/api/_test-sentry` debug route** stays in the codebase past Phase 0 with `ENABLE_TEST_SENTRY=false` in prod. Useful for periodic health checks. Plan to remove/replace with a real Sentry source-map verification cron in Phase 7 alongside the bootstrap-flag cron.

4. **Resend From-address is `onboarding@resend.dev`** until domain is registered + DNS-verified (Phase 6). Magic-link emails will work but appear from a generic Resend sender. Documented in runbook (T-33).

5. **`@better-auth/cli generate` produces a separate migration file** that lives outside our hand-curated schema. Schema drift between Better Auth upstream and our `drizzle/` is a watch-out. T-25 documents this; Phase 1 task that exercises Better Auth signup will validate alignment.

6. **`audit_log` does not yet store `actorIp` / `actorUserAgent`** despite spec mentioning them. Phase 7 (admin moderation) is the natural place to add them along with retention policy. T-0-02 / runbook (T-33) document this gap.

7. **`dbTx` proxy lazy-init pattern** is unconventional. If it causes issues with Drizzle's type narrowing on `db.transaction((tx) => ...)`, Phase 2 should refactor to a regular function `getDbTx()` exported instead.

</known_limitations>

---

<output>

After this plan completes, create `.planning/phases/00-skeleton-infra/00-01-SUMMARY.md` capturing:

- Final stack versions (in case re-verification needed)
- Final list of external services + their `vercel env ls` snapshot (without values)
- Sentry project URL + alert-rule ID
- Neon database URL hostname (no creds)
- GitHub repo URL + branch protection status
- Production URL (after manual promotion)
- All 6 ROADMAP success criteria with PASS/FAIL
- Any deviations from this PLAN encountered during execution

Use `$HOME/.claude/get-shit-done/templates/summary.md` as the structural template.

</output>
