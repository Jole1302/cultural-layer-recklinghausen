---
phase: 0
slug: skeleton-infra
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-28
updated: 2026-04-28
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/integration) + Playwright 1.59.x (e2e) + axe-core/playwright (a11y) + Lighthouse CI v12 (perf+a11y) |
| **Config file** | `vitest.config.ts` (T-07) + `playwright.config.ts` (T-08) + `lighthouserc.json` (T-11) |
| **Quick run command** | `pnpm test:unit` (Vitest, watch=false) — installed in T-06 |
| **Full suite command** | `pnpm test` = `pnpm typecheck && pnpm lint && pnpm test:unit` (defined in T-04) |
| **E2E command** | `pnpm test:e2e` (Playwright against `pnpm dev` locally; against Vercel preview URL in CI via `e2e.yml`) |
| **Estimated runtime** | Wave 0/1 unit ~30-90s (testcontainers boot dominates audit test); full PR cycle ~10 min including Vercel build + Playwright + Lighthouse |

---

## Sampling Rate

- **After every task commit:** Run `pnpm typecheck && pnpm lint && pnpm test:unit` (~30s baseline; +60s when audit test runs)
- **After every wave merge:** Full local suite + manual `pnpm dev` smoke
- **Before `/gsd-verify-work`:** All 4 GitHub Actions checks green on PR + Lighthouse + axe green on Vercel preview
- **Max feedback latency:** ≤ 120 seconds for unit; ≤ 10 min for full PR cycle

---

## Per-Task Verification Map

> Populated by gsd-planner during plan generation (2026-04-28).
> Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-00 | 00-01 | 0 | REQ-quality-bar | — | Vercel CLI ≥ 52 (prereq for `vercel integration add`, ENV separation) | manual | `vercel --version` returns ≥ 52.x | n/a (global install) | ⬜ pending |
| T-01 | 00-01 | 0 | REQ-quality-bar | — | Greenfield Next.js 16 init; tsconfig strict; `src/` boundary keeps schema out of client bundles | scaffold | `node -e "require('./package.json')"` confirms `next@16.x` | package.json | ⬜ pending |
| T-02 | 00-01 | 0 | REQ-quality-bar | — | `noUncheckedIndexedAccess` + `no-explicit-any`: type-safety against silent runtime nulls | type+lint | `pnpm tsc --noEmit && pnpm eslint . --max-warnings 0` | tsconfig.json, eslint.config.mjs | ⬜ pending |
| T-03 | 00-01 | 0 | REQ-quality-bar | T-0-01 | `.env*` gitignored (allow `.env.example`); secret-shape documented but no real values | grep gate | `grep -q '\.env\.local' .gitignore && grep -q 'DATABASE_URL' .env.example && test -f .prettierrc.json` | .gitignore, .env.example, .prettierrc.json, .prettierignore | ⬜ pending |
| T-04 | 00-01 | 0 | REQ-quality-bar | — | CI script wiring: typecheck/lint/test:unit/test:e2e/db:* present; matches workflow expectations | grep gate | `node -e "const s=require('./package.json').scripts; ['typecheck','lint','test:unit','test:e2e','db:generate','db:migrate'].forEach(k=>{if(!s[k])throw new Error('missing '+k)})"` | package.json | ⬜ pending |
| T-05 | 00-01 | 0 | REQ-quality-bar | T-0-01 | Husky pre-commit + gitleaks: blocks staged secrets locally before push | grep gate | `test -x .husky/pre-commit && test -f .gitleaks.toml && grep -q 'lint-staged' package.json` | .husky/pre-commit, .gitleaks.toml | ⬜ pending |
| T-06 | 00-01 | 0 | REQ-quality-bar | — | All test infra installed at pinned versions; testcontainers needs Docker (verified in CI runner) | grep gate | `node -e "const d=require('./package.json').devDependencies; ['vitest','@playwright/test','testcontainers','@testcontainers/postgresql','@axe-core/playwright'].forEach(k=>{if(!d[k])throw new Error('missing '+k)})"` | package.json | ⬜ pending |
| T-07 | 00-01 | 0 | REQ-quality-bar | — | Vitest config: `@/*` alias matches tsconfig; sequence.concurrent=false mitigates Pitfall 7 | smoke | `pnpm vitest run --reporter=basic --passWithNoTests` exits 0 | vitest.config.ts | ⬜ pending |
| T-08 | 00-01 | 0 | REQ-quality-bar | T-0-10 | Playwright config: bypass-token header for Vercel Preview access (controlled, no public spam path) | smoke | `pnpm playwright test --list` exits 0 | playwright.config.ts, tests/e2e/fixtures.ts | ⬜ pending |
| T-09 | 00-01 | 0 | REQ-audit-log | — | Testcontainers helper: real Postgres parity for CHECK + transaction semantics (DEC-018) | grep gate | `test -f tests/setup/pg-container.ts && grep -q 'PostgreSqlContainer' tests/setup/pg-container.ts` | tests/setup/pg-container.ts | ⬜ pending |
| T-10 | 00-01 | 0 | REQ-quality-bar | T-0-01 | CI workflow: typecheck/lint/vitest jobs + gitleaks-action backstop on every PR | grep gate | `test -f .github/workflows/ci.yml && grep -qE '(typecheck\|lint\|vitest\|secret-scan):' .github/workflows/ci.yml` | .github/workflows/ci.yml | ⬜ pending |
| T-11 | 00-01 | 0 | REQ-quality-bar | — | E2E + Lighthouse workflows triggered on `deployment_status` (Preview); 0.9 thresholds enforced | grep gate | `test -f .github/workflows/e2e.yml && test -f .github/workflows/lighthouse.yml && test -f lighthouserc.json && grep -q 'minScore' lighthouserc.json` | .github/workflows/e2e.yml, lighthouse.yml, lighthouserc.json | ⬜ pending |
| T-12 | 00-01 | 0 | REQ-audit-log + REQ-quality-bar | T-0-06 | drizzle.config.ts wired to `src/db/schema.ts`; `migrate` not `push` per DEC-010 anti-pattern | grep gate | `test -f drizzle.config.ts && grep -q 'src/db/schema.ts' drizzle.config.ts` | drizzle.config.ts | ⬜ pending |
| T-13 | 00-01 | 1b | REQ-quality-bar | T-0-01 | Zod-validated env: missing/malformed secret fails fast at server start (no silent runtime crashes) | type | `pnpm tsc --noEmit` | src/lib/env.ts | ⬜ pending |
| T-14 | 00-01 | 1b | REQ-audit-log + REQ-quality-bar | T-0-06 | Schema with all 10 tables + sql-template CHECKs (Pitfall 2) + 8 indexes; CASCADE/RESTRICT per CON-edge-cases | type+grep | `pnpm tsc --noEmit && grep -c "pgTable" src/db/schema.ts \| awk '{ if ($1 < 10) exit 1 }'` | src/db/schema.ts | ⬜ pending |
| T-15 | 00-01 | 1b | REQ-audit-log | T-0-06 | Two clients: `db` (HTTP) for reads, `dbTx` (WebSocket) for transactions per Pitfall 8 | type+grep | `pnpm tsc --noEmit && grep -q 'export const db ' src/db/index.ts && grep -q 'export const dbTx' src/db/index.ts` | src/db/index.ts | ⬜ pending |
| T-16 | 00-01 | 1b | REQ-audit-log + REQ-quality-bar | T-0-06 | drizzle-kit generate writes versioned SQL; CHECKs have NO `$N` placeholders (Pitfall 2 verified) | grep gate | `test -f drizzle/0000_*.sql && grep -c "CREATE TABLE" drizzle/0000_*.sql \| awk '{ if ($1 < 10) exit 1 }' && ! grep -E '\\$[0-9]+' drizzle/0000_*.sql \| head -1` | drizzle/0000_*.sql, drizzle/meta/_journal.json | ⬜ pending |
| T-17 | 00-01 | 1b | REQ-audit-log + REQ-quality-bar | T-0-06 | **[BLOCKING] Schema push** to Neon via `drizzle-kit migrate`; verifies live DB has all 10 tables + 8 indexes | live DB query | `psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN (...10 names...);" -t \| tr -d ' \n' \| grep -q '^10$'` | drizzle/meta/_journal.json (updated) | ⬜ pending |
| T-18 | 00-01 | 1b | REQ-audit-log | T-0-08 | `audit()` server-only; centralised mutation log; supports `actorUserId=NULL` for system actions | type+grep | `pnpm tsc --noEmit && grep -q "import 'server-only'" src/lib/audit.ts && grep -q "export async function audit" src/lib/audit.ts` | src/lib/audit.ts | ⬜ pending |
| T-19 | 00-01 | 1b | REQ-quality-bar | — | Rate-limit primitive: sliding-window via Upstash Redis (stateless-friendly per anti-pattern) | type+grep | `pnpm tsc --noEmit && grep -q 'magicLinkLimit' src/lib/ratelimit.ts && grep -q 'ticketRedeemLimit' src/lib/ratelimit.ts` | src/lib/ratelimit.ts | ⬜ pending |
| T-20 | 00-01 | 1b | REQ-audit-log | T-0-06 + T-0-08 | Testcontainers proves: **`audit()` helper called with injected db** writes NULL-actor row + writes real-actor row with correct meta (REQ-audit-log SC#4 in-phase, Blocker #1); `events.capacity > 0` CHECK rejects 0; bilateral CHECK rejects mismatch; tickets UNIQUE rejects duplicate | unit | `pnpm vitest run tests/unit/audit.test.ts` (5 tests pass) | tests/unit/audit.test.ts | ⬜ pending |
| T-21 | 00-01 | 1b | REQ-quality-bar | T-0-04 | GDPR cookie banner: DE locale, `necessary` only (no analytics cookies set before consent) | type+grep | `pnpm tsc --noEmit && grep -q "'use client'" src/components/cookie-banner.tsx && grep -q "default: 'de'" src/components/cookie-banner.tsx` | src/components/cookie-banner.tsx, src/app/globals.css | ⬜ pending |
| T-22 | 00-01 | 1b | REQ-quality-bar | T-0-04 | Landing page: `<html lang="de">`, h1 in DE, banner mounted, axe 0 violations, `lang="de"` validated | e2e | `pnpm playwright test tests/e2e/landing.spec.ts --project=chromium` (Playwright `webServer` config in T-08 spins up `pnpm dev` automatically; 4 tests pass) | src/app/layout.tsx, src/app/page.tsx, tests/e2e/landing.spec.ts | ⬜ pending |
| T-23 | 00-01 | 1a | REQ-quality-bar | — | `vercel link` + Neon Marketplace: auto-injected `DATABASE_URL` to all 3 envs; foundation for ENV separation | manual | `vercel env pull .env.local --environment=development && grep -q '^DATABASE_URL=postgres' .env.local` | .vercel/project.json (gitignored) | ⬜ pending |
| T-24 | 00-01 | 1a | REQ-quality-bar | — | Vercel Blob + Upstash Redis stores: auto-injected tokens to all envs | manual | `grep -E '^(BLOB_READ_WRITE_TOKEN\|UPSTASH_REDIS_REST_URL)=' .env.local \| wc -l` returns 2 | (no repo files; env-only) | ⬜ pending |
| T-25 | 00-01 | 2 | REQ-quality-bar (foundation for REQ-magic-link-auth) | T-0-07 | Better Auth: separate tables from domain `users` (Pitfall 6); schema-bound Drizzle adapter (Blocker #3); signup hook bridges to domain users + audits; magicLink+Resend wired; route handler exports GET/POST; smoke test asserts unauthenticated `getSession` returns null | type+grep+smoke | `pnpm tsc --noEmit && test -f src/db/auth-schema.ts && grep -q 'schema:' src/lib/auth.ts && grep -q 'databaseHooks' src/lib/auth.ts && pnpm vitest run tests/integration/better-auth-smoke.test.ts` | src/lib/auth.ts, src/lib/auth-client.ts, src/db/auth-schema.ts, src/app/api/auth/[...all]/route.ts, tests/integration/better-auth-smoke.test.ts | ⬜ pending |
| T-26 | 00-01 | 2 | REQ-quality-bar | T-0-05 | Debug route double-gated: env-flag (`ENABLE_TEST_SENTRY`) + token query param prevents prod abuse | type+grep | `pnpm typecheck && grep -q 'SENTRY_SMOKE_TEST' src/app/api/_test-sentry/route.ts && grep -q 'ENABLE_TEST_SENTRY' src/app/api/_test-sentry/route.ts` | src/app/api/_test-sentry/route.ts | ⬜ pending |
| T-27 | 00-01 | 2 | REQ-quality-bar | T-0-03, T-0-09 | Sentry wizard generates 4 config files + wraps `next.config.ts`; Telegram via first-party integration (no SSRF surface) | manual | (manual: visual confirm in Sentry org → Integrations; `.env.local` has `SENTRY_DSN=https://...`) | sentry.{client,server,edge}.config.ts, instrumentation.ts (root), next.config.ts (modified) | ⬜ pending |
| T-28 | 00-01 | 2 | REQ-quality-bar | T-0-09 | `withSentryConfig` confirmed; `cacheComponents: true` for p95<2s; `vercel.json` pins Node 24 + 300s (DEC-021) | grep gate | `grep -q 'withSentryConfig' next.config.ts && grep -q 'cacheComponents' next.config.ts && grep -q 'nodejs24' vercel.json` | next.config.ts, vercel.json | ⬜ pending |
| T-29 | 00-01 | 2 | REQ-quality-bar | T-0-01 | Vercel ENV separated dev/preview/prod; GitHub secrets for CI; cryptorandom `BETTER_AUTH_SECRET` × 3 | manual | `vercel env ls preview` and `vercel env ls production` enumerate distinct vars; `gh secret list` shows CI secrets present | (no repo files; env-only) | ⬜ pending |
| T-30 | 00-01 | 2 | REQ-quality-bar | — | GitHub branch protection: `typecheck` + `lint` + `vitest` + `secret-scan` + `playwright` required for merge to main | manual | (manual: visual in GitHub UI; verify via deliberate failing PR) | (no repo files; GitHub setting) | ⬜ pending |
| T-31 | 00-01 | 2 | REQ-quality-bar | — | Vercel "Stage and manually promote" toggle: enforces DEC-020 manual prod gate | manual | (manual: confirm push to main → Vercel deployment shows "Staged" not "Promoted") | (no repo files; Vercel setting) | ⬜ pending |
| T-32 | 00-01 | 2 | REQ-quality-bar (SC#1, SC#3, SC#5) + REQ-audit-log | T-0-09, T-0-05 | First green PR cycle: 4+ CI checks green; preview deployed staged; Sentry round-trip < 60s; Lighthouse perf+a11y ≥ 0.9; axe 0 violations | composite | `gh pr checks phase-0-skeleton 2>&1 \| grep -E '(typecheck\|lint\|vitest\|secret-scan\|playwright).*pass' \| wc -l \| awk '{ if ($1 < 5) exit 1 }'` (matches T-30 branch-protection 5-check contract) | (none new; deploys existing tree) | ⬜ pending |
| T-33 | 00-01 | 2 | REQ-quality-bar | T-0-02 | Runbook documents secret rotation, deploy promotion, alert rules, GDPR/PII gaps; final human verification of prod URL | manual | (human: visit prod, verify banner DE, audit_log queryable, Sentry has smoke error, Telegram delivered) | docs/runbook.md | ⬜ pending |
| T-34 | 00-01 | 2 | REQ-quality-bar + REQ-audit-log | — | STATE.md + ROADMAP.md updated to mark Phase 0 complete; cursor advanced to Phase 1 | grep gate | `grep -q 'Phase 0 complete' .planning/STATE.md && grep -E '\\- \\[x\\] \\*\\*Phase 0' .planning/ROADMAP.md` | .planning/STATE.md, .planning/ROADMAP.md | ⬜ pending |

**Sampling continuity check:** No 3 consecutive auto tasks lack an `<automated>` verify command — all 26 `auto` tasks have a verify; the 8 manual `checkpoint:*` tasks (T-00, T-23, T-24, T-27, T-29, T-30, T-31, T-33) are interleaved appropriately, never 3 in a row.

---

## Wave 0 Requirements

> All Wave 0 requirements covered by tasks T-01 through T-12. Wave 1 begins after T-12 commits.

- [x] `package.json` + `pnpm-lock.yaml` exist (T-01)
- [x] `vitest.config.ts` + `vitest` installed (T-06, T-07)
- [x] `playwright.config.ts` + `@playwright/test` installed (T-06, T-08)
- [x] `tsconfig.json` strict mode, `noUncheckedIndexedAccess: true` (T-01, T-02)
- [x] `eslint.config.mjs` + flat config with stricter rules (T-02)
- [x] `tests/setup/pg-container.ts` — testcontainers fixture (T-09; brought to life by T-20)
- [x] `tests/e2e/fixtures.ts` — Playwright + axe `makeAxeBuilder` fixture (T-08)
- [x] `tests/unit/audit.test.ts` — Postgres testcontainer fixture for REQ-audit-log (T-20, depends on T-14 + T-09)
- [x] `tests/e2e/landing.spec.ts` — Playwright landing-page e2e for REQ-quality-bar (T-22, depends on T-21+T-22)
- [x] `.github/workflows/ci.yml` — typecheck + lint + vitest + secret-scan jobs (T-10)
- [x] `.github/workflows/e2e.yml` + `lighthouse.yml` — Playwright + Lighthouse against preview URL (T-11)
- [x] `.gitleaks.toml` + Husky pre-commit hook (T-05)
- [x] `drizzle.config.ts` + drizzle-orm/drizzle-kit installed (T-12)
- [x] `lighthouserc.json` with 0.9 thresholds (T-11)

**Wave 0 complete** when all T-01..T-12 are green.

---

## Manual-Only Verifications

| Task | Behavior | Requirement | Why Manual | Test Instructions |
|------|----------|-------------|------------|-------------------|
| T-00 | Vercel CLI ≥ 52 globally installed | REQ-quality-bar (Vercel CLI is prereq for ENV management + Marketplace integration) | Global pnpm install requires user invocation | `pnpm add -g vercel@latest`; verify `vercel --version` ≥ 52 |
| T-23 | `vercel link` + Neon Marketplace integration | REQ-quality-bar SC#6 | `vercel link` is interactive; Neon Marketplace flow is dashboard-only | Run `vercel link`; provision Neon via Storage tab; pull `.env.local`; verify `DATABASE_URL` populated |
| T-24 | Vercel Blob + Upstash Redis Marketplace integrations | REQ-quality-bar SC#6 | Both are Marketplace UI flows | Provision via Storage tab; pull env; verify tokens present |
| T-27 | Sentry wizard + Telegram Alerts integration | REQ-quality-bar SC#3 | Wizard prompts interactively; Telegram requires OAuth bridge in Sentry org | Run `pnpm dlx @sentry/wizard@latest -i nextjs`; install Telegram Alerts Bot from Sentry org integrations; create P1 alert rule |
| T-29 | Vercel ENV separation (dev/preview/prod distinct) | REQ-quality-bar SC#6 | `vercel env ls` inspection is the only authoritative check; values must not be echoed | `vercel env ls preview && vercel env ls production` confirms distinct values; verify with `vercel env pull .env.local` works |
| T-30 | GitHub branch protection on `main` | REQ-quality-bar (CI gate) | UI-only setting; programmatic via `gh api` is brittle | GitHub Settings → Branches → require status checks `typecheck/lint/vitest/secret-scan/playwright` pass before merge |
| T-31 | Vercel "Stage and manually promote" toggle | REQ-quality-bar SC#1 (manual prod gate) + DEC-020 | Vercel project setting; no programmatic CLI flag in v52 | Vercel dashboard → Project → Settings → Deployment Protection → enable toggle; verify by pushing to main and observing "Staged" badge |
| T-33 | Runbook + final prod-URL verification | REQ-quality-bar SC#1, SC#3, SC#5; T-0-02 PII docs | Final acceptance is a human visiting the deployed URL and confirming all visible/UX criteria | Visit prod, verify DE landing + banner; check no analytics cookies; trigger smoke error; check Sentry + Telegram; query audit_log; confirm PR checks green |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly `checkpoint:human-action` / `checkpoint:human-verify` (no silent gaps)
- [x] Sampling continuity: no 3 consecutive auto tasks without automated verify (verified by hand against the per-task table above)
- [x] Wave 0 covers all MISSING test-infra references; Wave 1 unit tests can rely on T-09/T-14 outputs; Wave 2 e2e relies on T-22 baseline
- [x] No watch-mode flags (every command uses `vitest run`, `playwright test`, not `vitest`/`playwright test --ui`)
- [x] Feedback latency budget: ~30s unit / ~10 min full PR cycle, both within REQ-quality-bar tolerance
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-stage approved 2026-04-28; awaiting execution sign-off post-T-32.
