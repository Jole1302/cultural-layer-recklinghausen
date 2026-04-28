# Phase 0: Skeleton & Infra — Research

**Researched:** 2026-04-28
**Domain:** Next.js 16 production-grade greenfield bootstrap (App Router + Drizzle/Neon + Vercel + CI/Sentry/audit)
**Confidence:** HIGH

## Summary

This phase scaffolds a production-grade Next.js 16 monorepo-free single-app on Vercel with Drizzle/Neon, Better Auth, Resend, Vercel Blob, Sentry, GitHub Actions CI, Lighthouse + axe gates, a GDPR cookie banner, and the full 10-table schema migrated. Every locked decision (DEC-013..DEC-022) and every day-1 NFR (REQ-quality-bar) is enforced from first deploy — there is no "we'll add it later" path.

The stack is well-trodden in 2026: Next.js 16 went stable Q1 2026 with Turbopack as default bundler for both `dev` and `build`; the Vercel-managed Neon integration has first-class branch-per-PR support; Better Auth has a mature Drizzle adapter and a `magicLink` plugin that accepts a custom `sendMagicLink` (Resend slot in directly); `@sentry/nextjs` ships a wizard that wires `withSentryConfig` and source-map upload; Telegram alerts have a first-party Sentry integration. The only genuinely tricky piece is the bilateral DB invariant `(status='published') = (artistAck AND venueAck)` — Drizzle's `check()` function expressed via a `sql` template literal handles this cleanly (do NOT use Drizzle filter operators inside `check()` — they emit parameterised placeholders that Postgres rejects).

**Primary recommendation:** Bootstrap with `pnpm create next-app@latest` (TypeScript + Tailwind + ESLint + App Router + src/ + `@/*` alias), then layer in Drizzle (schema in `src/db/schema.ts`, migrations in `drizzle/`), Better Auth (`src/lib/auth.ts` with `magicLink` plugin), Sentry (run wizard, point to GitHub repo), Vercel-managed Neon (`vercel integration add neon`), and a 4-job GitHub Actions workflow (typecheck, lint, vitest, playwright). Disable Vercel auto-promotion to prod in Project Settings → Git → "Skip deployments" / "Production Branch promotion" so the manual gate from DEC-020 is enforced. Use `@neondatabase/serverless` driver via `drizzle-orm/neon-http` for runtime queries (HTTP, no pool to manage) and use the same driver in testcontainers via standard Postgres TCP for integration tests.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-quality-bar | Day-1 NFRs: 80% critical-path coverage, Lighthouse ≥90, WCAG 2.1 AA, Sentry, p95 <2s, rate-limits, CI gates, Vercel ENV separation, GDPR cookie banner | Sections: Standard Stack (Vitest/Playwright/Sentry/Lighthouse CI/axe), Architecture Patterns (CI workflow, ENV separation), Validation Architecture, Code Examples (axe-playwright fixture, Lighthouse-on-preview workflow) |
| REQ-audit-log | Audit-write helper writes to `audit_log` (with `actorUserId=NULL` for system actions); unit-tested on Postgres testcontainers | Sections: Standard Stack (testcontainers/postgresql), Code Examples (audit helper signature + test scaffold), Don't Hand-Roll (use `testcontainers` package, not raw `docker run`) |
</phase_requirements>

## Architectural Responsibility Map

Phase 0 establishes infrastructure across all tiers. Each capability the phase delivers maps to its standard owner so feature phases inherit a clean structure.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Next.js app shell + landing route | Frontend Server (SSR) | Browser | App Router renders on Node runtime; landing is mostly RSC, cookie banner is `'use client'` |
| Drizzle schema + migrations | Database / Storage | API/Backend | Schema lives in `src/db/schema.ts`; drizzle-kit owns migration files in `drizzle/` |
| Better Auth route handler | API/Backend | Database / Storage | `app/api/auth/[...all]/route.ts` runs on Node; Better Auth tables in same Postgres |
| Audit log helper | API/Backend | Database / Storage | Server-only function; never importable from `'use client'` |
| Sentry instrumentation | API/Backend + Frontend Server + Browser | — | Three Sentry config files (server, edge — but we don't use edge so it's a no-op stub, client) |
| GitHub Actions CI | CI/CD | — | Out-of-app concern; runs on GitHub-hosted runners |
| Vercel deployment + ENV | CDN/Static + API/Backend | — | Vercel Functions on Fluid Compute (Node 24, 300s) per DEC-021 |
| Vercel Blob client | API/Backend | Browser | Server signs upload URL; browser PUTs directly to Blob |
| GDPR cookie banner | Browser | — | Pure client-side; no Server Action needed (just localStorage) |
| Rate limit primitive | API/Backend | Database / Storage | Establish the helper in Phase 0; first concrete use is Phase 1 (`/api/auth/magic-link`) |

**Misassignment to avoid:** The Drizzle schema must NOT live inside `app/` (it would get bundled into client routes) and Sentry's `instrumentation.ts` must be at the project root, not under `src/` unless `experimental.instrumentationHook` is in `next.config.ts` (in Next.js 16 instrumentation is stable and the file lives at the root or `src/instrumentation.ts` if `srcDir` is detected — verify with the wizard output).

## Standard Stack

All versions verified via `npm view <pkg> version` on **2026-04-28** [VERIFIED: npm registry].

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | Framework | DEC-013 lock; App Router + Turbopack default + React 19.2 [VERIFIED: npm registry] |
| `react` / `react-dom` | 19.2.5 | UI runtime | Required by Next.js 16 [VERIFIED: npm registry] |
| `drizzle-orm` | 0.45.2 | ORM | DEC-010 lock; type-safe, lighter than Prisma [VERIFIED: npm registry] |
| `drizzle-kit` | 0.31.10 (devDep) | Migration tooling | DEC-010 lock; `generate` + `migrate` workflow [VERIFIED: npm registry] |
| `@neondatabase/serverless` | 1.1.0 | Postgres driver | DEC-009 lock; HTTP/WebSocket modes; recommended by Neon for Vercel [VERIFIED: npm registry] |
| `better-auth` | 1.6.9 | Auth | DEC-008 lock; magicLink plugin slot accepts Resend [VERIFIED: npm registry] |
| `resend` | 6.12.2 | Email | DEC-014 lock [VERIFIED: npm registry] |
| `@vercel/blob` | 2.3.3 | File storage | DEC-011 lock [VERIFIED: npm registry] |
| `zod` | 4.3.6 | Validation (FE↔API) | DEC-015 lock [VERIFIED: npm registry] |
| `tailwindcss` | 4.2.4 | CSS | DEC-016 lock; v4 `@theme` directive supported by shadcn CLI [VERIFIED: npm registry] |
| `swr` | 2.4.1 | Polling/cache (later phases) | DEC-012 lock; install in Phase 0 so it's already in the lockfile [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/nextjs` | 10.50.0 | Error monitoring | DEC-019; wizard generates client/server config + wraps `next.config.ts` [VERIFIED: npm registry] |
| `vitest` | 4.1.5 | Unit/integration tests | DEC-018 [VERIFIED: npm registry] |
| `@playwright/test` | 1.59.1 | E2E tests | DEC-018 [VERIFIED: npm registry] |
| `testcontainers` | 11.14.0 | Postgres integration container | DEC-018 (`@testcontainers/postgresql` is the typed sub-package) [VERIFIED: npm registry] |
| `@axe-core/playwright` | latest | A11y assertion in E2E | REQ-quality-bar WCAG 2.1 AA gate [CITED: playwright.dev/docs/accessibility-testing] |
| `@upstash/ratelimit` + `@upstash/redis` | latest | Rate limit primitive | REQ-quality-bar (`/api/auth/magic-link` 10/min/IP, `/api/tickets/redeem` 50/min/venue). Vercel-blessed pattern; serverless-friendly [CITED: upstash.com/blog/nextjs-ratelimiting] |
| `vanilla-cookieconsent` | latest | GDPR banner | Lightweight, plain-JS, GDPR-compliant; mounts as a client component [CITED: github.com/orestbida/cookieconsent] |
| `qrcode` | 1.5.4 | QR generation | DEC-017; install now to lock version, used Phase 4 [VERIFIED: npm registry] |
| `@zxing/browser` | 0.2.0 | QR scanning | DEC-017; install now, used Phase 5 [VERIFIED: npm registry] |
| `eslint-config-next` | 16.2.4 | Linting | matches Next.js version [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@neondatabase/serverless` | `pg` (node-postgres) | `pg` is fine on Vercel Functions (Node, persistent-ish), but Neon's HTTP driver is connection-less → no pool exhaustion; matches the official Neon-Vercel integration; recommended even for Node runtime per Neon docs [CITED: neon.com/docs/serverless/serverless-driver]. **Decision: use Neon HTTP driver via `drizzle-orm/neon-http`.** |
| `testcontainers` | `@electric-sql/pglite` (in-memory WASM Postgres) | PGlite is faster (zero Docker), but does not match Neon-on-Postgres parity for CHECK constraints, transaction isolation, `SELECT FOR UPDATE` semantics that the bilateral state machine relies on. **Decision: keep testcontainers per DEC-018.** |
| `vanilla-cookieconsent` | Hand-rolled banner | DEC-022 spirit (don't hand-roll commodity infra); vanilla-cookieconsent is ~30KB, has prebuilt EU-locale JSON, no telemetry. Hand-rolled is fine but invites edge-case bugs (consent re-prompt on cookie clear, etc.). |
| Sentry → Telegram (custom webhook) | Sentry's first-party Telegram Alerts Bot integration | Official integration is install-and-go, no infra to maintain. **Decision: use first-party integration** [CITED: docs.sentry.io/organization/integrations/notification-incidents/telegram-alerts-bot/] |
| `@vercel/firewall` rate limit | `@upstash/ratelimit` + Upstash Redis | Vercel Firewall is Pro/Enterprise plan and rule-based (not user-configurable per-route logic). Upstash Ratelimit is the canonical Vercel-template approach for per-route limits with custom keys (IP for magic-link, venueId for redeem) [CITED: vercel.com/templates/next.js/ratelimit-with-upstash-redis] |
| Drizzle migrations (`generate` + `migrate`) | Drizzle `push` | `push` is dev-only (no migration files in git). DEC-010 explicitly mandates "migrations versioned in git" → use `drizzle-kit generate` (writes SQL files to `drizzle/`) + `drizzle-kit migrate` (applies them). |

**Installation (one-liner per group, after `pnpm create next-app@latest`):**

```bash
# DB + ORM
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit @types/pg

# Auth + Email + Storage + Validation
pnpm add better-auth resend @vercel/blob zod

# Realtime / data fetching (used Phase 4+)
pnpm add swr

# QR (lock versions for Phases 4-5)
pnpm add qrcode @zxing/browser
pnpm add -D @types/qrcode

# UI base
pnpm dlx shadcn@latest init        # interactive: pick "default" style, "neutral" base color
pnpm add vanilla-cookieconsent

# Errors
pnpm dlx @sentry/wizard@latest -i nextjs

# Tests
pnpm add -D vitest @vitest/ui @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
pnpm add -D @playwright/test
pnpm add -D testcontainers @testcontainers/postgresql
pnpm add -D @axe-core/playwright

# Rate limit
pnpm add @upstash/ratelimit @upstash/redis
```

**Version verification:** All versions above were confirmed against the npm registry on 2026-04-28 with `npm view <pkg> version`. Re-run before lockfile commit if Phase 0 work begins more than 7 days from research date.

## Architecture Patterns

### System Architecture Diagram

```
                ┌──────────────────────────────────────────────────┐
                │                  GitHub Actions                   │
                │   PR push → 4 parallel jobs (typecheck, lint,    │
                │   vitest, playwright-against-Vercel-preview)     │
                │   ──────────────────────────────────────────────  │
                │   merge to main blocked unless all 4 green       │
                └─────────────────────┬────────────────────────────┘
                                      │ (merge to main)
                                      ▼
                ┌──────────────────────────────────────────────────┐
                │              Vercel build (Turbopack)             │
                │   sentry-cli uploads source maps via SENTRY_AUTH │
                │   builds to .next/, deploys as Preview           │
                │   (auto-promotion DISABLED → manual prod gate)   │
                └─────────────┬───────────────────┬────────────────┘
                              │                   │
              Browser request │                   │ Webhook (Vercel→Neon)
                              ▼                   ▼
                ┌──────────────────────┐  ┌──────────────────────┐
                │  Vercel Function     │  │  Neon (Postgres)     │
                │  (Fluid Compute,     │  │  branch-per-PR for   │
                │   Node 24, 300s)     │◄─┤  preview, prod       │
                │   - Next.js Route    │  │  branch for prod     │
                │     Handler / RSC    │  └──────────────────────┘
                │   - Better Auth      │              ▲
                │   - audit() helper   │              │ Drizzle (HTTP driver)
                │   - Sentry capture   │              │
                │   - Resend send      │  ┌──────────────────────┐
                │   - Blob signed URL  │  │  drizzle-kit         │
                └──────┬─────┬─────────┘  │  generate / migrate  │
                       │     │            │  (run in CI before   │
                       │     │            │   prod deploy)       │
                       ▼     ▼            └──────────────────────┘
              Sentry      Vercel Blob
              (errors)    (poster, photo)
                  │
                  │ first-party integration
                  ▼
              Telegram Alerts Bot (P1 channel) + Email
```

The browser tier here is intentionally thin in Phase 0: a placeholder landing route, the cookie banner client component, and the Sentry browser SDK. Heavy lifting (RSC rendering, route handlers, audit writes, Better Auth) all runs server-side on the Node runtime — Edge is **not used** per DEC-021/DEC-022.

### Recommended Project Structure

```
saas/
├── .github/
│   └── workflows/
│       ├── ci.yml              # typecheck + lint + vitest (PR + main)
│       ├── e2e.yml             # playwright against Vercel preview URL
│       └── lighthouse.yml      # treosh/lighthouse-ci-action against preview
├── .planning/                   # already exists
├── docs/                        # already exists
├── drizzle/                     # generated SQL migration files (committed to git)
│   ├── 0000_initial.sql
│   └── meta/
│       └── _journal.json
├── public/                      # static assets
├── src/
│   ├── app/                     # App Router routes
│   │   ├── layout.tsx           # root layout w/ <html lang="de">, cookie banner mount
│   │   ├── page.tsx             # placeholder landing
│   │   ├── globals.css          # Tailwind 4 entry
│   │   └── api/
│   │       └── auth/
│   │           └── [...all]/
│   │               └── route.ts # Better Auth handler
│   ├── components/
│   │   ├── ui/                  # shadcn/ui drops here
│   │   └── cookie-banner.tsx    # 'use client'; vanilla-cookieconsent wrapper
│   ├── db/
│   │   ├── index.ts             # Drizzle client (neon-http)
│   │   └── schema.ts            # all 10 tables in one file (small enough)
│   ├── lib/
│   │   ├── auth.ts              # Better Auth instance + Drizzle adapter + magicLink+Resend
│   │   ├── auth-client.ts       # client-side Better Auth (magicLinkClient)
│   │   ├── audit.ts             # audit() helper — single export, server-only
│   │   ├── ratelimit.ts         # Upstash Ratelimit instances per surface
│   │   └── env.ts               # zod-validated process.env reader
├── tests/
│   ├── unit/
│   │   └── audit.test.ts        # testcontainers-backed
│   ├── e2e/
│   │   ├── landing.spec.ts      # Lighthouse + axe assertions
│   │   └── fixtures.ts          # axe fixture
│   └── setup/
│       └── pg-container.ts      # shared testcontainers setup
├── drizzle.config.ts            # schema path, out path, dialect
├── instrumentation.ts           # Sentry server init (root, not src/)
├── sentry.client.config.ts      # generated by wizard
├── sentry.server.config.ts      # generated by wizard
├── sentry.edge.config.ts        # generated by wizard (no-op stub since no Edge)
├── next.config.ts               # withSentryConfig wrap
├── playwright.config.ts
├── vitest.config.ts
├── tsconfig.json                # strict: true, paths: { "@/*": ["./src/*"] }
├── eslint.config.mjs            # flat config (Next.js 16 default)
├── .env.example                 # documents required ENV vars (no real values)
├── .env.local                   # local dev, gitignored
└── package.json
```

**Two reasons for `src/`:** (1) keeps the app code separate from config/migration files for clearer mental model; (2) Sentry wizard auto-detects `src/` and places `instrumentation.ts` correctly. **Decision: use `src/`** [VERIFIED: nextjs.org/docs/app/api-reference/cli/create-next-app — `--src-dir` is a documented flag].

### Pattern 1: Drizzle table with CHECK + composite UNIQUE + indexes

```typescript
// src/db/schema.ts
// Source: orm.drizzle.team/docs/indexes-constraints (verified 2026-04-28)
import {
  pgTable, pgEnum, uuid, text, integer, timestamp, boolean,
  check, unique, index, jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const eventStatusEnum = pgEnum('event_status', [
  'proposed', 'published', 'cancelled', 'completed',
]);

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    artistId: uuid('artist_id').notNull().references(() => users.id),
    venueId: uuid('venue_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull(),
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
  (table) => [
    // CRITICAL: use sql template literal, NOT Drizzle filter operators —
    // operators emit $1/$2 placeholders that Postgres rejects in CHECK.
    check('events_capacity_positive', sql`${table.capacity} > 0`),
    check(
      'events_published_iff_both_ack',
      sql`(${table.status} = 'published') = (${table.artistAck} AND ${table.venueAck})`,
    ),
    index('events_status_start_idx').on(table.status, table.startAt),
    index('events_artist_status_idx').on(table.artistId, table.status),
    index('events_venue_status_idx').on(table.venueId, table.status),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    qrHash: text('qr_hash').notNull(),
    status: text('status', { enum: ['active', 'used', 'cancelled'] }).notNull().default('active'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    unique('tickets_event_user_uq').on(table.eventId, table.userId),
    unique('tickets_qrhash_uq').on(table.qrHash),
    index('tickets_event_status_idx').on(table.eventId, table.status),
    index('tickets_user_status_idx').on(table.userId, table.status),
  ],
);
```

**When to use:** Every table that has DB-enforced invariants. The CHECK + UNIQUE + index pattern is the *only* defence against the marketplace race conditions (CON-edge-cases) — application code is allowed to fail; the database is not.

### Pattern 2: Drizzle client wired to Neon HTTP

```typescript
// src/db/index.ts
// Source: orm.drizzle.team/docs/get-started/neon-new (verified 2026-04-28)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '@/lib/env';

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

**When to use:** Single shared module imported by every server file. Never import `@/db` from a `'use client'` component (the build will fail loudly because `@neondatabase/serverless` is server-only).

### Pattern 3: Better Auth with magicLink + Resend + Drizzle

```typescript
// src/lib/auth.ts
// Source: better-auth.com/docs/installation + community magicLink+Resend recipe
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from '@/db';
import { env } from '@/lib/env';

const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
  appName: 'Cultural Layer Recklinghausen',
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min — REQ-magic-link-auth (Phase 1 acceptance)
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: 'Cultural Layer <noreply@cultural-layer.de>',
          to: email,
          subject: 'Dein Login-Link',
          html: `<p>Klicke hier, um dich anzumelden: <a href="${url}">${url}</a></p><p>Der Link ist 15 Minuten gültig.</p>`,
        });
      },
    }),
  ],
});
```

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
export const { POST, GET } = toNextJsHandler(auth);
```

**When to use:** Better Auth is wired in Phase 0 (so the schema migration includes its `user`/`session`/`account`/`verification` tables alongside our 10), but the UI flow (`/login`, `/auth/verify`) is built in Phase 1. Magic-link send is exercised via a smoke test in Phase 0 to prove the wiring.

### Pattern 4: Audit helper (server-only, NULL actor allowed)

```typescript
// src/lib/audit.ts
// REQ-audit-log
import 'server-only';
import { db } from '@/db';
import { auditLog } from '@/db/schema';

export type AuditAction =
  | 'event.publish' | 'event.cancel' | 'event.bootstrap'
  | 'user.suspend' | 'user.activate'
  | 'ticket.redeem' | 'ticket.cancel';

export async function audit(params: {
  actorUserId: string | null;     // null = system
  action: AuditAction | string;   // string for forward-compat
  target: string;                 // e.g. 'event:42'
  meta?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values({
    actorUserId: params.actorUserId,
    action: params.action,
    target: params.target,
    meta: params.meta ?? {},
  });
}
```

**When to use:** Imported from every server action / route handler that mutates state. The `'server-only'` import makes it a hard build error to import from a client component. Phase 0 ships the helper + a unit test on testcontainers Postgres (REQ-audit-log acceptance #4).

### Pattern 5: GitHub Actions CI (4-job, fan-out)

```yaml
# .github/workflows/ci.yml
# Source: synthesis from coffey.codes + kontent.ai patterns + Vercel docs
name: CI
on:
  pull_request:
  push:
    branches: [main]

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
      - run: pnpm tsc --noEmit

  lint:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm eslint .

  vitest:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # testcontainers needs Docker; ubuntu-24.04 runner has it preinstalled
      - run: pnpm vitest run --coverage

  playwright:
    # Splits into separate workflow file e2e.yml triggered on deployment_status
    # because Playwright needs the Vercel preview URL — see e2e.yml below.
    if: false # placeholder — actual job lives in e2e.yml
    runs-on: ubuntu-24.04
    steps: []
```

```yaml
# .github/workflows/e2e.yml — runs against Vercel preview URL
name: E2E (Playwright)
on:
  deployment_status:
jobs:
  playwright:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm playwright test
        env:
          PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
          # Vercel Deployment Protection bypass token
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
```

**Why two workflows:** Fast feedback (typecheck/lint/vitest) runs on `pull_request` and finishes in <2 min. Playwright waits for Vercel to finish building (~3-5 min) and runs against the actual preview URL — hence the `deployment_status` trigger. Branch protection on `main` requires all four checks to pass [CITED: enreina.com/blog/e2e-testing-in-next-js-with-playwright-vercel-and-github-actions].

### Pattern 6: Vercel manual prod-promotion gate (DEC-020)

There are two equivalent ways:

1. **Project Settings → Git → Production Branch:** point to a branch that does not exist (e.g. `release`) — every push to `main` produces a Preview only, and prod deploys must be triggered with `vercel deploy --prod` manually or via the dashboard "Promote to Production" button.
2. **Project Settings → Deployment Protection → Production Deployments → "Stage and manually promote":** the modern toggle. This deploys to a staged production environment and requires explicit "Promote" action [CITED: vercel.com/changelog/stage-and-manually-promote-deployments-to-production, vercel.com/docs/deployments/promoting-a-deployment].

**Decision: use option (2) — the modern toggle.** It plays better with the Neon-Vercel integration which uses the production environment variables for the prod branch; option (1) requires juggling DATABASE_URL between branches.

### Anti-Patterns to Avoid

- **Edge runtime anywhere.** DEC-021 and DEC-022 are clear. Don't add `export const runtime = 'edge'` to any route. Do not use `proxy.ts` with edge runtime (Next.js 16 renamed `middleware.ts` → `proxy.ts` and made `nodejs` the only runtime — good, no action needed) [CITED: nextjs.org/docs/app/guides/upgrading/version-16].
- **Drizzle filter operators inside `check()`.** Use `sql\`...\`` template literals only — operators like `gt(table.col, 0)` emit parameterised `$1` placeholders that Postgres rejects [CITED: github.com/drizzle-team/drizzle-orm/issues/4661].
- **`drizzle-kit push` in production.** Push is dev-only and bypasses the migration journal. Use `generate` (writes SQL files to git) + `migrate` (applies them) per DEC-010.
- **Schema imports inside `app/`.** Put `schema.ts` in `src/db/`, never inside `app/`. Otherwise the bundler may pull driver code into client routes.
- **Hand-rolled rate limit with `setInterval` / Map.** Vercel Functions are stateless across cold starts — in-memory state evaporates. Use Upstash Redis (or Vercel KV which is also Upstash under the hood).
- **Sentry source maps unguarded by `SENTRY_AUTH_TOKEN`.** Without the token in CI, source maps don't upload silently and Sentry shows obfuscated traces. Add the token to GitHub Actions secrets and Vercel ENV.
- **Cookie banner that blocks SSR.** Mount it as a client component lazy-loaded after first paint; never block first paint waiting for `localStorage.getItem('cookie_consent')`.
- **Skipping `.env.example`.** Without it, no contributor (or future-Jakob) knows what to set in Vercel ENV. Maintain it as part of every Phase 0 task that adds a new env var.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic-link token issuance + replay protection | Custom HMAC + rotation logic | Better Auth `magicLink` plugin | Single-use, expiry, hash-at-rest already implemented; wide test surface in upstream |
| QR generation/scanning | Bit-pattern impl | `qrcode` (gen) + `@zxing/browser` (scan) | DEC-017 lock; ECC, masking, camera permission UX already solved |
| Cookie banner UX + persistence | Custom React state | `vanilla-cookieconsent` | German GDPR edge cases (re-prompt on cookie clear, granular categories) handled |
| Postgres test fixtures | `pg-mem` or stubs | `testcontainers/postgresql` | DEC-018 mandates real Postgres; CHECK constraints and `SELECT FOR UPDATE` only behave correctly on real Postgres |
| Email sending | `nodemailer` + SMTP | Resend | DEC-014 lock; bounce webhook is built-in (REQ-magic-link-auth acceptance) |
| File upload | Custom multipart | `@vercel/blob` signed upload URLs | DEC-011 lock; bypasses serverless function 4.5 MB body limit |
| A11y assertions | Manual contrast math | `@axe-core/playwright` with `wcag2a, wcag2aa, wcag21a, wcag21aa` tags | Catches 57% of issues automatically; contradiction-free with magazine-aesthetic CSS layer because axe checks computed contrast |
| Lighthouse runs in CI | `lighthouse-cli` raw | `treosh/lighthouse-ci-action@v12` | Handles Chrome install, output parsing, PR comments |
| Telegram alerting | Bot tokens + webhook server | Sentry's first-party Telegram Alerts Bot integration | Zero infra, install-and-go [CITED: docs.sentry.io] |
| Rate limiting | In-memory `Map` keyed by IP | `@upstash/ratelimit` + Upstash Redis | Vercel Functions are stateless across cold starts — in-memory limits don't work |
| Audit log infra | Loki / external log service | Postgres `audit_log` table + simple helper | Spec is explicit (CON-data-model); single Postgres = single backup story |

**Key insight:** Phase 0 is dominated by infrastructure choices that are easy to get wrong subtly (silent source-map upload failure, in-memory rate limit that "works" in dev, hand-rolled CHECK that ships invalid SQL). Lean on first-party / community-blessed solutions for each one.

## Runtime State Inventory

> Greenfield phase — Step 2.5 is **not applicable**. There is no pre-existing runtime state to inventory because the repo is empty. The first concrete external state created in this phase is:
> - Neon database (created via Vercel Marketplace integration)
> - Vercel project (created via `vercel link` or dashboard)
> - Sentry project (created via wizard)
> - Resend domain + DNS records (set up manually for `cultural-layer.de` or chosen domain)
> - GitHub Actions secrets (`SENTRY_AUTH_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET`)
>
> Every one of these is brand-new and gets documented in `.env.example` + a `docs/runbook.md` (recommended Phase 0 deliverable). Future rename phases will need to inventory these.

## Common Pitfalls

### Pitfall 1: Synchronous `params` / `cookies()` / `headers()` in route handlers

**What goes wrong:** Code copied from Next.js 14/15 tutorials does `const { slug } = params` or `const c = cookies()`. In Next.js 16 these are async and the build (or runtime) errors.
**Why it happens:** Next.js 15 deprecated sync access; Next.js 16 removed it entirely [CITED: nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change].
**How to avoid:** Always `await params`, `await cookies()`, `await headers()`. Use the codemod `npx @next/codemod@canary upgrade latest` if migrating any tutorial code; for greenfield code, write async from day one.
**Warning signs:** TypeScript error `Property 'slug' does not exist on type 'Promise<...>'`.

### Pitfall 2: CHECK constraint not generated when using Drizzle filter operators

**What goes wrong:** `check('positive', gt(table.capacity, 0))` generates SQL with `$1` placeholders and Postgres rejects the migration.
**Why it happens:** Drizzle filter operators are designed for query builders, not DDL [CITED: github.com/drizzle-team/drizzle-orm/issues/4661].
**How to avoid:** Always use `sql\`${table.capacity} > 0\`` template literals inside `check()`.
**Warning signs:** drizzle-kit `generate` produces empty CHECK constraints OR `migrate` fails with "could not determine data type of parameter $1".

### Pitfall 3: Sentry source maps not uploaded in production

**What goes wrong:** Errors in Sentry show minified `a.b.c (n.js:1:42)` with no original file/line.
**Why it happens:** `SENTRY_AUTH_TOKEN` is missing from Vercel ENV (or GitHub Actions if you're building there). Wizard configures the upload but silently no-ops without the token.
**How to avoid:** After wizard, immediately add `SENTRY_AUTH_TOKEN` to Vercel ENV (all three: dev/preview/prod) and to GitHub Actions secrets. Verify with a deliberate `throw new Error('source map smoke test')` in a route after first prod deploy — Phase 0 success criterion #3.
**Warning signs:** Sentry issue page shows "no source maps found for this release" warning.

### Pitfall 4: Vercel auto-promotes preview to prod

**What goes wrong:** Push to `main` → automatic prod deploy. Violates DEC-020 (manual gate).
**Why it happens:** Vercel default is to auto-promote main-branch builds to prod.
**How to avoid:** Project Settings → Deployment Protection → toggle "Stage and manually promote production deployments". Verify by pushing a commit to `main` and confirming the deployment shows as "Staged" with a Promote button [CITED: vercel.com/changelog/stage-and-manually-promote-deployments-to-production].
**Warning signs:** A change to `main` immediately appears at the production URL.

### Pitfall 5: Cookie banner FOUC (flash of un-styled content) on first load

**What goes wrong:** Banner renders, then hides, then shows again — bad UX, fails Lighthouse CLS metric.
**Why it happens:** Banner mounts client-side, reads localStorage on first effect, re-renders to hide. Both states paint.
**How to avoid:** Render banner inside a `<Suspense fallback={null}>` and check `localStorage.getItem('cc_cookie')` before the first paint via a tiny inline script in `<head>` that sets `document.documentElement.dataset.consent="given"` — banner CSS uses `[data-consent="given"] & { display: none }` to suppress without JS round-trip.
**Warning signs:** Lighthouse CLS > 0.1 on `/`; visible banner-flash in slow-network preview.

### Pitfall 6: Better Auth schema collides with our `users` table

**What goes wrong:** Better Auth's CLI generates a `user` table; spec already specifies a `users` table (plural, with role/status enums).
**Why it happens:** Better Auth defaults to its own schema; doesn't know about our domain `users`.
**How to avoid:** Configure Better Auth to use **our** `users` table via `database: drizzleAdapter(db, { provider: 'pg', schema: { user: ourUsersTable, ... } })`, OR keep them separate (Better Auth manages `user`, `session`, `account`, `verification`; we keep our `users` for profile/role data and FK from Better Auth's `user.id` to ours). **Recommended: keep separate but enforce 1:1** — Better Auth's `user.email` mirrors our `users.email`; on Better Auth signup, server hook creates the row in our `users` with role from invite token. This is cleaner because Better Auth schema can change with upstream upgrades; ours is stable.
**Warning signs:** Two tables with overlapping fields; FK confusion in queries.

### Pitfall 7: Testcontainers Postgres parallelism in Vitest

**What goes wrong:** Tests run in parallel by default in Vitest; one test drops a table while another is reading it; flakes.
**Why it happens:** Vitest worker model + single shared Postgres container [CITED: dev.to/jcteague/using-testconatiners-with-vitest-499f].
**How to avoid:** Either (a) start a fresh container per test file via `beforeAll`/`afterAll`, or (b) use `vitest --no-file-parallelism` for integration tests (slower but bulletproof), or (c) start one container in `globalSetup`, give each suite its own database (`CREATE DATABASE test_${suiteId}`).
**Warning signs:** Random `relation "audit_log" does not exist` failures only in CI, not local.

### Pitfall 8: Neon HTTP driver doesn't support transactions

**What goes wrong:** Code uses `db.transaction(async (tx) => { ... })` with the HTTP driver and gets a runtime error.
**Why it happens:** HTTP mode is one query per HTTP POST — no session, no transaction state [CITED: pkgpulse.com/blog/pg-vs-postgres-js-vs-neon-serverless-postgresql-drivers-2026].
**How to avoid:** For routes that need transactions (RSVP capacity check, double-ACK race, audit-with-mutation), use the **WebSocket driver** instead: `import { Pool } from '@neondatabase/serverless'; import { drizzle } from 'drizzle-orm/neon-serverless';`. Phase 0 should expose **two** drizzle clients: `db` (HTTP, fast reads) and `dbTx` (WebSocket, transactions). Route handlers pick the right one.
**Warning signs:** `transaction is not a function` errors.

## Code Examples

### `drizzle.config.ts`

```typescript
// Source: orm.drizzle.team/docs/get-started/neon-new
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### `src/lib/env.ts` — zod-validated env

```typescript
// Source: synthesis (zod + Next.js best practice)
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(), // Neon provides both
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().startsWith('re_'),
  BLOB_READ_WRITE_TOKEN: z.string().startsWith('vercel_blob_rw_'),
  SENTRY_DSN: z.string().url(),
  SENTRY_AUTH_TOKEN: z.string().optional(), // only needed at build time
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  ENABLE_BOOTSTRAP: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email(), // ENV-provisioned admin per REQ-roles-rbac
});

export const env = schema.parse(process.env);
```

### Audit helper unit test (testcontainers)

```typescript
// tests/unit/audit.test.ts
// Source: testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle<typeof schema>>;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
}, 60_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

describe('audit()', () => {
  it('writes a row with actorUserId=NULL for system actions', async () => {
    const { audit } = await import('@/lib/audit');
    await audit({
      actorUserId: null,
      action: 'event.bootstrap',
      target: 'event:test-1',
      meta: { reason: 'cold-start seed' },
    });

    const rows = await db.select().from(schema.auditLog).where(isNull(schema.auditLog.actorUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('event.bootstrap');
    expect(rows[0].meta).toEqual({ reason: 'cold-start seed' });
  });
});
```

### Lighthouse CI workflow (against Vercel preview URL)

```yaml
# .github/workflows/lighthouse.yml
# Source: github.com/treosh/lighthouse-ci-action + OskarAhl/Lighthouse-github-action-comment
name: Lighthouse
on:
  deployment_status:
jobs:
  lighthouse:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview'
    runs-on: ubuntu-24.04
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

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }]
      }
    }
  }
}
```

### Playwright + axe a11y fixture

```typescript
// tests/e2e/fixtures.ts
// Source: playwright.dev/docs/accessibility-testing
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const test = base.extend({
  makeAxeBuilder: async ({ page }, use) => {
    const make = () =>
      new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    await use(make);
  },
});
export { expect };
```

```typescript
// tests/e2e/landing.spec.ts
import { test, expect } from './fixtures';

test('/ has zero WCAG 2.1 AA violations', async ({ page, makeAxeBuilder }) => {
  await page.goto('/');
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});
```

### Cookie banner client component

```typescript
// src/components/cookie-banner.tsx
'use client';
// Source: github.com/orestbida/cookieconsent (v3 API)
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
                  'Diese Seite verwendet ausschließlich technisch notwendige Cookies. Keine Tracking-Cookies, keine Analytics.',
                acceptAllBtn: 'Verstanden',
              },
              preferencesModal: {
                title: 'Cookie-Einstellungen',
                acceptAllBtn: 'Alle akzeptieren',
                savePreferencesBtn: 'Auswahl speichern',
                sections: [
                  {
                    title: 'Technisch notwendig',
                    description: 'Erforderlich für Login und Session.',
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

### Upstash rate limit instances

```typescript
// src/lib/ratelimit.ts
// Source: upstash.com/blog/nextjs-ratelimiting + Vercel template
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const magicLinkLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'), // REQ-magic-link-auth: 10/min/IP
  analytics: true,
  prefix: 'rl:magiclink',
});

export const ticketRedeemLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '60 s'), // REQ-qr-checkin-scanner: 50/min/venue
  analytics: true,
  prefix: 'rl:redeem',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `params`/`cookies()`/`headers()` | Async — must `await` | Next.js 16 (Q1 2026) | Removes ambiguity; codemod available; greenfield code naturally complies |
| `middleware.ts` with edge runtime | `proxy.ts` with Node-only runtime | Next.js 16 | We don't use either heavily yet; if we add one in Phase 1+ for role gating, it must be `proxy.ts` |
| Webpack default for `next build` | Turbopack default | Next.js 16 | Faster builds; no action needed for greenfield |
| `experimental.dynamicIO` | `cacheComponents: true` | Next.js 16 | If we use Cache Components for p95<2s NFR, set `cacheComponents: true` in `next.config.ts` |
| `next lint` | `eslint` direct via flat config | Next.js 16 (removed) | CI runs `pnpm eslint .` not `pnpm next lint` |
| `images.domains` config | `images.remotePatterns` | Next.js 15+ stable in 16 | When wiring Vercel Blob image rendering, use `remotePatterns` |
| `pg` driver on Vercel Functions | `@neondatabase/serverless` (HTTP / WebSocket) | 2024+ Neon-on-Vercel pattern | No connection pool to manage; works in any Vercel region |
| Custom cookie banner | `vanilla-cookieconsent` v3 | mature 2024+ | DOM-free SSR-safe; lightweight |
| `next-auth` v4/v5 | Better Auth | 2025 standard for greenfield | Better Auth is more flexible (custom schemas) and ships first-class plugins (`magicLink`) |
| Manual Sentry source-map upload via `sentry-cli` in CI | `withSentryConfig` from `@sentry/nextjs` wraps `next.config.ts` and uploads during build | 2024+ | Wizard handles it; only need `SENTRY_AUTH_TOKEN` |

**Deprecated/outdated:**
- `next/legacy/image` — use `next/image` always.
- `next lint` command — removed in Next.js 16.
- `serverRuntimeConfig` / `publicRuntimeConfig` — removed; use `process.env` + zod.
- `experimental.ppr` segment config — removed; use `cacheComponents: true`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sentry's first-party Telegram Alerts Bot integration works on Sentry Cloud (not just self-hosted) | Standard Stack / Don't Hand-Roll | If cloud-only is wrong, fall back to webhook → Telegram bot via cloudflare worker. Verify by checking Sentry org admin → Integrations during Phase 0 setup. |
| A2 | Better Auth's `user` table can coexist with our domain `users` table via FK | Pitfall 6 | If Better Auth requires schema rewriting, we may need to alias fields; doesn't block Phase 0 but makes Phase 1 more complex. Plan to validate by running `npx auth@latest generate` early in Phase 0 and inspecting output. |
| A3 | Upstash Redis is the right choice over Vercel KV (which is now also Upstash-backed) | Standard Stack | Vercel KV is just rebranded Upstash, so no functional difference. Go direct to Upstash for portability if we ever leave Vercel. |
| A4 | `vanilla-cookieconsent` satisfies German GDPR for an analytics-free site with only essential cookies (session) | Cookie banner pattern | Likely fine — analytics-free + necessary-only is the simplest GDPR case. If a privacy lawyer disagrees, we may need a more elaborate banner; not a Phase 0 blocker. |
| A5 | Neon HTTP driver works for the audit helper test's `migrate()` call from testcontainers | Audit helper test | The test uses `node-postgres` (`pg` package) explicitly because testcontainers exposes a TCP URI, not Neon HTTP. This is correct as written — tests use real `pg`, runtime uses Neon HTTP. Both go through Drizzle. |
| A6 | The 8 day-1 indexes from CON-data-model are exhaustive for Phase 0 | Standard Stack / Drizzle pattern | If a query plan in Phase 1+ turns up missing index, easy to add via new migration. |
| A7 | Vercel Functions on Fluid Compute (Node 24, 300s) is the default behaviour without per-route `runtime` exports | Architecture | Verified DEC-021 says this is the default; if Vercel changes defaults, Phase 0 task should add `vercel.json` with `functions` config to lock it. |
| A8 | A 22-char base64url crypto-random `qrHash` collision probability is negligible at v1 scale (~thousands of tickets) | Pattern (tickets schema) | 22 base64url chars = 132 bits of entropy. Collision prob is far below 1 in 2^60. UNIQUE constraint catches the impossible case. Safe. |
| A9 | The Resend "from:" domain `cultural-layer.de` is the chosen domain | Auth pattern | User must own & DNS-verify the domain before Phase 1's magic-link UI can be tested live. Phase 0 task should include "register domain + verify in Resend dashboard" or chosen domain. **Confirm domain choice before plan execution.** |
| A10 | Neon-Vercel managed integration creates branches automatically per PR — no GitHub Actions step needed | Architecture diagram | Verified [CITED: neon.com/docs/guides/vercel-managed-integration]; webhook-driven from Vercel side. |

**A9 in particular:** the domain name has not been chosen by the user. Phase 0 plan must surface this question to the user before tasks begin. If domain is undecided, Phase 0 still ships (Resend works on `onboarding@resend.dev` for testing), but Phase 1 needs the real domain to ship REQ-magic-link-auth.

## Open Questions

1. **Domain name for Resend / production URL**
   - What we know: Spec uses `cultural-layer.de` informally in examples; user owns no confirmed domain yet.
   - What's unclear: actual domain, whether Vercel will host it directly or via custom DNS.
   - Recommendation: surface to user as a 5-minute decision before Phase 0 tasks begin. If undecided, default to `*.vercel.app` for dev/preview and `resend.dev` for outbound emails until domain is registered.

2. **Vercel team / org for the project**
   - What we know: User is solo dev, will likely use Vercel Hobby or Pro tier.
   - What's unclear: Hobby tier limits (e.g., per-project ENV count, GitHub Actions minutes if Sentry source maps are big) may bite at Phase 4+ traffic.
   - Recommendation: Hobby tier is fine for Phase 0; revisit at Phase 4 launch.

3. **Monorepo structure (single Next.js project — DEC-022 confirmed no Turbo monorepo)**
   - Confirmed: single `package.json` at repo root, `src/` for app code. No workspaces.

4. **Sentry organization (new vs existing)**
   - What we know: User has a personal Sentry org likely.
   - Recommendation: create a new project under existing org named `cultural-layer-recklinghausen`; share API key via Vercel ENV.

5. **Cron / scheduled functions wiring (Phase 2 + Phase 7 use them)**
   - What we know: Spec mentions "Vercel scheduled function" for 24h auto-completion (REQ-bilateral-marketplace-state-machine) and 8-week bootstrap-flag check (REQ-admin-moderation).
   - What's unclear: Phase 0 doesn't ship a cron, but `vercel.json` with `crons: [...]` will be needed in Phase 2.
   - Recommendation: Phase 0 creates an empty `vercel.json` with the schema validated; subsequent phases append cron entries.

6. **Branch strategy: single `main` only, or `main` + `release`?**
   - What we know: DEC-020 says "manual gate to production". Two ways to enforce (see Pattern 6).
   - Recommendation: single `main`, use Vercel's "Stage and manually promote" toggle — simpler workflow, plays well with Neon-Vercel branching.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 (≥20.9 required) | ✓ | 22.22.2 | — (Vercel runs 24, local 22 is fine for dev) |
| pnpm | Recommended package manager | ✓ | 10.32.1 | npm 10.9.7 also works |
| Docker | testcontainers (integration tests) | ✓ | 29.2.1 | — |
| psql client | Manual DB inspection | ✓ | 16.13 | — |
| Vercel CLI | `vercel link`, `vercel env pull`, `vercel integration add neon` | ⚠️ | 50.44.0 (current is 52+) | **Upgrade required** before Phase 0 tasks: `pnpm add -g vercel@latest` (per STATE.md blocker) |
| GitHub CLI | Optional, for PR / actions | ✓ | 2.45.0 | gh web also works |
| git | Source control | ✓ | 2.43.0 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Vercel CLI version drift — STATE.md flags this as a blocker. First Phase 0 task should `pnpm add -g vercel@latest` and verify `vercel --version` ≥ 52. Without the upgrade, `vercel integration add neon` may not be available [CITED: vercel.com/docs/cli/integration].

## Validation Architecture

> Per `workflow.nyquist_validation` default: enabled (config.json absent). Including this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (unit + integration); Playwright 1.59.1 (e2e); axe-core/playwright (a11y); Lighthouse CI v12 (perf+a11y) |
| Config file | `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json` — all created in Wave 0 of this phase |
| Quick run command | `pnpm vitest run` (unit), `pnpm vitest run tests/unit/audit.test.ts` (just audit) |
| Full suite command | `pnpm vitest run --coverage && pnpm playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-quality-bar | typecheck passes | type | `pnpm tsc --noEmit` | ❌ Wave 0 |
| REQ-quality-bar | lint passes | lint | `pnpm eslint .` | ❌ Wave 0 |
| REQ-quality-bar | unit suite green | unit | `pnpm vitest run` | ❌ Wave 0 |
| REQ-quality-bar | e2e suite green against deployed preview | e2e | `pnpm playwright test` (uses `PLAYWRIGHT_TEST_BASE_URL`) | ❌ Wave 0 |
| REQ-quality-bar | `/` Lighthouse Mobile ≥ 90 | perf | `npx @lhci/cli@latest autorun` (also runs in `lighthouse.yml` workflow) | ❌ Wave 0 |
| REQ-quality-bar | `/` axe → zero WCAG 2.1 AA violations | a11y | `pnpm playwright test tests/e2e/landing.spec.ts -g "WCAG"` | ❌ Wave 0 |
| REQ-quality-bar | GDPR cookie banner renders on `/` | e2e | `pnpm playwright test -g "cookie banner"` | ❌ Wave 0 |
| REQ-quality-bar | deliberate-error in deployed route surfaces in Sentry | manual | smoke test: deploy then `curl preview-url/api/_sentry-test` and check Sentry within 60s | ❌ N/A (manual) — Phase 0 task documents the curl command + acceptance |
| REQ-quality-bar | merge to `main` blocked unless 4 CI checks pass | manual | configure GitHub branch protection rule "require status checks: typecheck, lint, vitest, playwright" — verified by attempting a PR with a failing test | ❌ N/A (manual) |
| REQ-quality-bar | Vercel preview→prod requires manual promotion | manual | toggle "Stage and manually promote" in Vercel project settings; verified by pushing to main and confirming deployment shows "Staged" not "Promoted" | ❌ N/A (manual) |
| REQ-audit-log | `audit()` writes a row | unit | `pnpm vitest run tests/unit/audit.test.ts -t "writes a row"` | ❌ Wave 0 |
| REQ-audit-log | `audit()` allows actorUserId=NULL for system | unit | `pnpm vitest run tests/unit/audit.test.ts -t "actorUserId=NULL"` | ❌ Wave 0 |
| REQ-audit-log | `audit_log(target, createdAt DESC)` index exists | migration | inspect generated `drizzle/0000_*.sql` for `CREATE INDEX ... ON audit_log (target, created_at DESC)` | ❌ Wave 0 |
| Schema | All 10 tables migrate to Neon successfully | integration | testcontainers test that runs `migrate()` then `SELECT 1 FROM <each_table>`; also verified manually via `psql $DATABASE_URL -c '\dt'` after `drizzle-kit migrate` | ❌ Wave 0 |
| Schema | `events.capacity > 0` CHECK rejects 0 | unit | testcontainers test inserts capacity=0, expects error | ❌ Wave 0 |
| Schema | `(status='published') = (artistAck AND venueAck)` CHECK rejects mismatched state | unit | testcontainers test inserts published with artistAck=false, expects error | ❌ Wave 0 |
| Schema | `tickets(eventId,userId)` UNIQUE rejects duplicate | unit | testcontainers test inserts twice, expects unique-violation | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm tsc --noEmit && pnpm eslint . && pnpm vitest run` (~30s)
- **Per wave merge:** Full Vitest + Playwright against local `pnpm dev` (~3 min)
- **Phase gate:** Full CI green (4 checks) on a PR + Lighthouse + axe green on Vercel preview before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — root config, jsdom for component tests, coverage v8
- [ ] `playwright.config.ts` — Chromium only initially, `baseURL` from env
- [ ] `lighthouserc.json` — assertion thresholds 0.9 perf+a11y
- [ ] `tests/setup/pg-container.ts` — shared testcontainers helper
- [ ] `tests/e2e/fixtures.ts` — axe `makeAxeBuilder` fixture
- [ ] `tests/unit/audit.test.ts` — REQ-audit-log unit test
- [ ] `tests/e2e/landing.spec.ts` — landing page smoke + a11y
- [ ] `.github/workflows/ci.yml`, `e2e.yml`, `lighthouse.yml`
- [ ] `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] `eslint.config.mjs` — flat config with `eslint-config-next` extension
- [ ] Branch protection rule on `main` requiring all 4 status checks
- [ ] Framework install commands listed in Standard Stack section above

## Project Constraints (from CLAUDE.md)

> No `./CLAUDE.md` exists in the project root (only the user's home memory file). The session-level user-memory rule "respond in Russian" applies to my human-facing replies but does not affect the contents of RESEARCH.md (which targets the planner).

**Implicit constraints from the planning suite that the planner must honor:**

- DEC-001..DEC-022 are **locked** (per intel/decisions.md) — research above respects every one.
- Rejected stack items in DEC-022: never propose Firebase, Cloudinary, Stripe, web-push, microservices, Edge runtime, Turbo monorepo. The Architecture Patterns section is explicit: Node-only runtime, no Edge, single Next.js project, no monorepo tooling.
- All NFRs from CON-quality-nfrs are day-1 binding (REQ-quality-bar). The Validation Architecture section enumerates each NFR's test command.

## Sources

### Primary (HIGH confidence — official docs verified during this research)
- [Next.js Upgrading: Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) — full breaking change list including async APIs, Turbopack default, middleware→proxy, removed `next lint`
- [Next.js 16 release post](https://nextjs.org/blog/next-16) — Cache Components, React 19.2, Turbopack stable
- [Drizzle ORM — Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints) — exact syntax for `check()`, `unique()`, `index()` with multi-column DESC
- [Drizzle ORM — Get Started with Neon](https://orm.drizzle.team/docs/get-started/neon-new) — config + driver setup
- [Drizzle ORM — Database connection overview](https://orm.drizzle.team/docs/connect-overview) — neon-http vs neon-serverless tradeoffs
- [Better Auth — Installation](https://better-auth.com/docs/installation) — Drizzle adapter, Next.js handler, schema generation
- [Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/) — wizard, source maps, `withSentryConfig`
- [Sentry — Telegram Alerts Bot integration](https://docs.sentry.io/organization/integrations/notification-incidents/telegram-alerts-bot/) — first-party integration, owner perms required
- [Neon-Managed Vercel Integration](https://neon.com/docs/guides/neon-managed-vercel-integration) and [Vercel-Managed Neon Integration](https://neon.com/docs/guides/vercel-managed-integration) — branch-per-PR, env var injection
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) — HTTP vs WebSocket modes
- [Vercel — Stage and manually promote](https://vercel.com/changelog/stage-and-manually-promote-deployments-to-production) — DEC-020 enforcement mechanism
- [Vercel — Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment) — manual promotion procedure
- [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing) — `@axe-core/playwright` + `withTags(['wcag2aa', ...])`
- [treosh/lighthouse-ci-action](https://github.com/treosh/lighthouse-ci-action) — Lighthouse CI on Vercel preview URL
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) — `@theme` directive, `tw-animate-css`
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — `pnpm dlx shadcn@latest init`
- [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) — v3 plain-JS GDPR plugin
- [Upstash Ratelimit on Next.js](https://upstash.com/blog/nextjs-ratelimiting) — slidingWindow, Redis.fromEnv()
- [Vercel template — Ratelimit with Upstash Redis](https://vercel.com/templates/next.js/ratelimit-with-upstash-redis) — canonical pattern

### Secondary (MEDIUM confidence — community recipes verified against official patterns)
- [E2E Testing in Next.js with Playwright, Vercel, GitHub Actions](https://enreina.com/blog/e2e-testing-in-next-js-with-playwright-vercel-and-github-actions-a-guide-with-example/) — `deployment_status` trigger pattern
- [Production-grade CI/CD with Next.js/Vercel](https://coffey.codes/articles/production-grade-ci-cd-with-nextjs-vercel-and-github-actions) — 4-job fan-out pattern
- [Magic link with Better Auth + Resend](https://dev.to/daanish2003/magic-link-authentication-using-betterauth-nextjs-shadcn-prisma-resend-tailwindcss-1hjl) — `sendMagicLink` slot
- [Using Testcontainers with Vitest](https://dev.to/jcteague/using-testconatiners-with-vitest-499f) — parallelism caveat
- [pg vs postgres.js vs @neondatabase/serverless 2026](https://www.pkgpulse.com/blog/pg-vs-postgres-js-vs-neon-serverless-postgresql-drivers-2026) — driver choice rationale

### Tertiary (LOW confidence — single source, marked for validation during execution)
- [tuanngocptn/sentry-telegram-webhook](https://github.com/tuanngocptn/sentry-telegram-webhook) — community fallback if first-party Telegram integration is unavailable
- [Lighthouse on Vercel preview](https://dev.to/oskarahl/automated-lighthouse-score-on-your-pr-with-vercel-and-github-actions-2ng2) — alternative to treosh action

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every package version verified on npm registry today; every choice is a locked DEC-* decision.
- Architecture: **HIGH** — patterns verified from official docs (Next.js, Drizzle, Better Auth, Sentry, Vercel) within the last 2 weeks.
- Pitfalls: **HIGH** for Drizzle CHECK + Next.js 16 async APIs (verified from official sources/issues); **MEDIUM** for testcontainers parallelism (single community source plus my own pattern knowledge).
- Validation: **HIGH** — every NFR maps to a concrete command; the manual gates (Sentry smoke test, branch protection toggle, Vercel manual-promote toggle) are explicitly flagged as manual.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days — stack is mostly stable; Next.js 16.x and Drizzle minor releases unlikely to break this surface; re-verify if Phase 0 work begins after this date).
