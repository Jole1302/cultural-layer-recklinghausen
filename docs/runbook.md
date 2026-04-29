# Phase 0 Deploy Runbook — Cultural Layer Recklinghausen

**Maintained by:** Jakob  
**Last updated:** 2026-04-29 (Phase 0 Wave 2)  
**Status:** Live on Vercel; Sentry/GH connection pending (T-27 verify, T-29–T-32 blocked on human actions)

---

## External Services

### Vercel
- **Project:** `cultural-layer-recklinghausen` (jole1302s-projects org)
- **Project ID:** `prj_9qOjJGmaWtzzJM5YWE5Vgbe7CtZ5`
- **Dashboard:** https://vercel.com/jole1302s-projects/cultural-layer-recklinghausen
- **Production URL:** https://cultural-layer-recklinghausen.vercel.app
- **Deployment Protection:** "Stage and manually promote" must be enabled (T-29 — pending).
  Until T-29 is done, pushes to main may auto-promote. See [Deployment Promotion](#deployment-promotion).

### Neon (Postgres)
- **Database:** `neon-claret-brush`
- **Host:** `ep-holy-frog-amziaatt-pooler.c-5.us-east-1.aws.neon.tech`
- **Dashboard:** https://console.neon.tech/app/projects (find `neondb_owner` project)
- **Branches:** `main` = production. Branch-per-PR will be enabled after GH connection (T-30).
- **Tables (Phase 0):** 10 domain tables + 4 Better Auth tables (`user`, `session`, `account`, `verification`)
- **Verify live:** `psql $DATABASE_URL -c "\dt"` — should show 14 tables

### Sentry
- **Status:** Pending — Sentry account not yet created (T-27 checkpoint blocked).
- **Planned project:** `cultural-layer-recklinghausen` (Next.js platform)
- **DSN:** Will be `SENTRY_DSN` in Vercel ENV after T-27 is completed.
- **P1 Alert channel:** Telegram (Telegram Alerts Bot integration in Sentry settings)
- **Dashboard:** https://sentry.io (once account created)

### Resend (Email)
- **Status:** Pending — API key not yet registered.
- **Placeholder:** `.env.local` has `re_placeholder_not_real_yet` (local dev only, never commit).
- **Required for:** Magic link delivery (Phase 1).
- **Registration:** https://resend.com → create API key → `vercel env add RESEND_API_KEY`

### Upstash (Redis / Rate Limiting)
- **Status:** Pending — no account yet.
- **Fallback:** `ratelimit.ts` uses `NOOP_LIMIT` when `UPSTASH_REDIS_REST_URL` is absent.
  Rate limiting is soft-disabled in Phase 0; tighten in Phase 1.
- **Registration:** https://upstash.com → create Redis Free tier DB → copy REST_URL + REST_TOKEN →
  `vercel env add UPSTASH_REDIS_REST_URL` + `vercel env add UPSTASH_REDIS_REST_TOKEN`

### Vercel Blob
- **Store:** `cultural-layer-blob` (store_WYrWSfO3lUpmdSND), public, iad1 region
- **Token:** `BLOB_READ_WRITE_TOKEN` — auto-injected by Vercel Marketplace integration
- **Dashboard:** Vercel Project → Storage → Blob

---

## Secret Rotation Procedures

### `BETTER_AUTH_SECRET`
1. Generate new secret: `openssl rand -hex 32`
2. Remove old: `vercel env rm BETTER_AUTH_SECRET production` (repeat for preview/development)
3. Add new: `vercel env add BETTER_AUTH_SECRET` (paste same value for all 3 environments, or
   generate 3 separate values for stricter isolation)
4. Pull locally: `vercel env pull .env.local --environment=development`
5. Redeploy: trigger a new Vercel deployment (push a commit or use `vercel deploy`)
6. **Impact:** All existing sessions are invalidated — users must re-authenticate.

### `RESEND_API_KEY`
1. Rotate at https://resend.com → API Keys → revoke old, create new
2. `vercel env rm RESEND_API_KEY production && vercel env add RESEND_API_KEY`
3. Repeat for preview and development environments
4. Pull: `vercel env pull .env.local --environment=development`
5. **Impact:** Zero downtime; new key used on next deploy

### `SENTRY_AUTH_TOKEN`
1. Rotate at https://sentry.io → User Settings → Auth Tokens
2. `vercel env rm SENTRY_AUTH_TOKEN && vercel env add SENTRY_AUTH_TOKEN`
3. Update GitHub repo secret: Settings → Secrets → `SENTRY_AUTH_TOKEN` → update value
4. **Impact:** Source map uploads fail on next CI build until token is rotated

### `BLOB_READ_WRITE_TOKEN`
1. Rotate at Vercel Dashboard → Project → Storage → Blob → Settings → Regenerate Token
2. `vercel env rm BLOB_READ_WRITE_TOKEN && vercel env add BLOB_READ_WRITE_TOKEN`
3. Pull: `vercel env pull .env.local --environment=development`
4. **Impact:** All in-flight uploads using old token fail; regenerate immediately after removing

### `UPSTASH_REDIS_REST_TOKEN`
1. Rotate at https://console.upstash.com → Database → Details → Reset Password
2. `vercel env rm UPSTASH_REDIS_REST_TOKEN && vercel env add UPSTASH_REDIS_REST_TOKEN`
3. `vercel env rm UPSTASH_REDIS_REST_URL && vercel env add UPSTASH_REDIS_REST_URL`
4. **Impact:** All rate-limit checks fall back to NOOP during the rotation window

---

## Deployment Promotion

**DEC-020 requires explicit human promotion to production.** No auto-promote.

### Setup (T-29 — pending)
Enable in Vercel Dashboard → Project → Settings → Deployment Protection →
"Stage and manually promote production deployments" → ON.

### Normal promotion flow
1. Merge PR to `main` via GitHub
2. Vercel builds and creates a "Staged" deployment (NOT promoted)
3. CI checks (typecheck, lint, vitest, e2e, lighthouse) run on the preview
4. Verify preview URL manually: check DE landing, no JS errors, Sentry event captured
5. Vercel Dashboard → Deployments → find the Staged build → "Promote to Production"
6. Verify production URL responds with correct content

### Emergency rollback
1. Vercel Dashboard → Deployments → find previous production build
2. Click "..." → "Promote to Production" (instant redeploy of old build)
3. Investigate the bad build; fix in a new PR

---

## Sentry → Telegram Alert Pipeline

**Status:** Pending T-27 completion (Sentry account + DSN required).

### Setup procedure (T-27)
1. Register at sentry.io → create project `cultural-layer-recklinghausen` (Next.js)
2. Add DSN + auth token to Vercel: `vercel env add SENTRY_DSN` etc.
3. Sentry → Settings → Integrations → "Telegram Alerts Bot" → install + link to Telegram channel
4. Create alert rule: Sentry project → Alerts → "Create Alert" → `event.level == 'error'` →
   action: Telegram channel `#recklinghausen-p1`

### Testing the pipeline
1. Enable test route: `vercel env add ENABLE_TEST_SENTRY` → value `true` for Development only
2. Get DEBUG_TOKEN from `.env.local`
3. Start local dev server: `pnpm dev`
4. Trigger: `curl "http://localhost:3000/api/_test-sentry?token=$DEBUG_TOKEN"`
5. Expected: HTTP 500 + error appears in Sentry within 60s + Telegram notification
6. After verification: set `ENABLE_TEST_SENTRY=false` in production Vercel ENV

---

## Branch Protection Rules

**Status:** Pending T-30 (GitHub repo connection required).

### Required status checks (names from `.github/workflows/ci.yml`)
- `typecheck` — TypeScript `--noEmit` zero errors
- `lint` — ESLint zero errors/warnings
- `vitest` — all unit + integration tests pass
- `secret-scan` — gitleaks pre-commit scan
- `playwright` — E2E tests against Vercel preview (from `e2e.yml`, after first preview deploy)

### GitHub UI path
Repository → Settings → Branches → "Add rule" → branch: `main` →
enable: "Require PR before merging" + "Require status checks to pass" → add checks above.

---

## Schema Migration Procedure

**Tools:** `drizzle-kit generate` (writes SQL) + `drizzle-kit migrate` (applies to DB)

### Adding a new migration
1. Edit `src/db/schema.ts` (or `src/db/auth-schema.ts` for Better Auth tables)
2. Generate SQL: `pnpm db:generate`
   - Drizzle inspects schema diff and writes `drizzle/NNNN_<tag>.sql`
   - Inspect the SQL before committing — especially for DROP TABLE / DROP COLUMN
3. Review the generated SQL in `drizzle/NNNN_<tag>.sql`
4. Commit both the schema change and the migration file
5. Apply to Neon: `pnpm db:migrate` (requires DATABASE_URL in env)
6. For preview branches (post-T-30): Neon will auto-provision a branch DB per PR;
   the CI step `pnpm db:migrate` in `ci.yml` applies migrations to the branch DB

### Better Auth table migrations
Better Auth manages its own 4 tables (`user`, `session`, `account`, `verification`).
When upgrading `better-auth` version:
1. Run `npx @better-auth/cli generate --output drizzle/NNNN_better_auth_upgrade.sql`
2. Compare with `src/db/auth-schema.ts` — update Drizzle declarations to match
3. Follow normal migration procedure above

---

## PII / GDPR Notes

**Per T-0-02 threat model (Phase 0 decisions):**

- `audit_log` table: does NOT store IP address or User-Agent in v1. Only `actor_user_id`,
  `action`, `target` (string reference), and `meta` (JSONB). JSONB must NOT contain raw PII.
- If Phase 7 adds IP/UA to audit_log: document retention policy (recommend 90-day TTL,
  implement via Neon cron or a scheduled cleanup function).
- Cookie consent: `vanilla-cookieconsent v3` — banner in German; only `necessary` category
  is active in Phase 0 (no analytics/tracking cookies). Phase 1 may add an opt-in category
  for performance monitoring (Sentry replay).
- Magic link tokens: stored as HMAC hashes in `magic_link_tokens.tokenHash` (Phase 1 wire),
  not plaintext. Single-use + 15min TTL enforced by Better Auth.
- User email: stored in both `users.email` (domain table) and Better Auth `user.email`.
  Bridge via email (not FK) is intentional for Phase 0 simplicity.

---

## Cold-Start Gate

**CON-cold-start-operational (in-code parts):**

- Landing page shows waitlist CTA when `<2 PUBLISHED` events exist (Phase 1 wires the count).
- `/admin/events/new` bootstrap-create form is gated by `ENABLE_BOOTSTRAP=true` ENV flag
  (Phase 7 implementation). Currently always returns 403/404.
- Cron alert: after 8 weeks (or 10 published events), alert fires if `ENABLE_BOOTSTRAP`
  is still `true` (Phase 7 implementation).

**To bootstrap first real events (Phase 7):**
1. Set `ENABLE_BOOTSTRAP=true` in Vercel ENV (production)
2. Log in as admin (`ADMIN_EMAIL`)
3. Use `/admin/events/new` to create seed events
4. After seed events are published: set `ENABLE_BOOTSTRAP=false`
