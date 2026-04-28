---
phase: 0
slug: skeleton-infra
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/integration) + Playwright 1.59.x (e2e) |
| **Config file** | `vitest.config.ts` + `playwright.config.ts` (Wave 0 installs) |
| **Quick run command** | `pnpm test:unit` (Vitest, watch=false) |
| **Full suite command** | `pnpm test` (typecheck + lint + vitest + playwright) |
| **Estimated runtime** | ~60–120 seconds (greenfield, small surface) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ≤ 120 seconds

---

## Per-Task Verification Map

> *Populated by gsd-planner during plan generation.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | REQ-quality-bar / REQ-audit-log | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> *Populated by gsd-planner. Greenfield repo: Wave 0 must install the entire test infrastructure before any feature task can have a verify command.*

- [ ] `package.json` + `pnpm-lock.yaml` exist (project init)
- [ ] `vitest.config.ts` + `vitest` installed
- [ ] `playwright.config.ts` + `@playwright/test` installed
- [ ] `tsconfig.json` strict mode
- [ ] `eslint.config.mjs` + flat config
- [ ] `tests/audit.test.ts` — Postgres testcontainer fixture stub for REQ-audit-log
- [ ] `tests/landing.spec.ts` — Playwright landing-page e2e stub for REQ-quality-bar (axe + Lighthouse hooks)
- [ ] `.github/workflows/ci.yml` — typecheck + lint + vitest + playwright jobs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel "Stage and manually promote" toggle is ON in Project Settings → Deployment Protection | REQ-quality-bar SC#1 | Vercel project setting — no programmatic CLI flag in v52 | Visit Vercel dashboard → Project → Settings → Deployment Protection → enable toggle. Verify by pushing a commit and observing that no auto-promotion to prod happens. |
| Sentry → Telegram alert routing for P1 errors | REQ-quality-bar SC#3 | Sentry org-level integration; requires manual OAuth bridge to Telegram bot | Install Sentry's Telegram Alerts Bot integration in org settings, configure rule "When event severity = P1 → notify Telegram channel #recklinghausen-p1". Trigger a test error from `/api/_test-sentry` route and confirm Telegram delivery. |
| GDPR cookie banner copy reviewed for German legal compliance | REQ-quality-bar SC#5 | Legal language requires human review (DE-language phrasing for Datenschutz) | Render banner on `/`, capture screenshot, confirm banner has: (a) accept/reject buttons of equal prominence, (b) link to Datenschutz page, (c) no cookies set before consent. |
| Vercel ENV separation (dev/preview/prod) for Vercel Blob, Resend, Better Auth secrets | REQ-quality-bar SC#6 | Manual `vercel env ls` inspection — no automated assertion possible without leaking values | Run `vercel env ls preview` and `vercel env ls production`, confirm distinct values for `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`. Confirm `.env.local` is in `.gitignore`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
