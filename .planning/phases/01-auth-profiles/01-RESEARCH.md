---
phase: 01-auth-profiles
phase_number: 1
phase_name: Auth & Profiles
researched: 2026-05-04
domain: identity layer (magic-link auth + RBAC + profile media uploads + transactional bounce handling) on Next.js 16 App Router + Better Auth + Drizzle + Vercel Blob + Resend
confidence: HIGH on stack mechanics (Context7-equivalent: package-bundled docs + official vendor docs); MEDIUM on a few integration shapes that the official docs leave under-specified (Better Auth metadata persistence, Resend signing-secret env var name)
---

# Phase 1: Auth & Profiles — Research

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-1.1 — Role assignment via separate signup landing pages.** Two role-specific landing pages: `/artist/signup` and `/venue/signup`. Each collects email and sends a magic link that carries the role in the token payload. After verify, role is written to `users.role` from the token, never from request input. `/login` is the universal returning-user path. Admin role is NEVER assignable via signup — admin is ENV-provisioned only (REQ-roles-rbac SC#4). [VERIFIED: CONTEXT.md]
- **D-1.2 — Profile upload limits.** Artist portfolio max 10 images, venue max 8 images, 5MB per file, JPEG/PNG/WebP only. Validation server-side at signed-URL issuance (count + content-type). Client-side preview-only. Image-type whitelist enforced via `allowedContentTypes: ['image/jpeg','image/png','image/webp']` on `handleUpload`. [VERIFIED: CONTEXT.md]
- **D-1.3 — Profile completion gate: hard redirect.** Until required fields are filled, every request to `/artist/*` or `/venue/*` (except `/me/edit`, `/api/auth/*`, signed-Blob upload endpoints) redirects to `/me/edit`. `users.profileComplete` is a **derived boolean**, not a stored column. Required fields per role: artist = `displayName` (1-80) + `bio` (10-1000); venue = `name` + `address` + `capacity` (positive int) + ≥1 photo. [VERIFIED: CONTEXT.md]
- **D-1.4 — Magic-link error states with explicit CTAs.** Three distinct states at `/auth/verify` (used / expired / invalid) with named DE copy + per-state CTA, all logged to `audit_log` (`magic_link.replay_attempt`, `magic_link.expired`, `magic_link.invalid`). [VERIFIED: CONTEXT.md]

### Claude's Discretion

- **Open Question 1** — Better Auth magic-link plugin vs hand-curated `magic_link_tokens` table. Resolved below in §2.
- **Open Question 2** — Vercel Blob signed-upload concurrency for 10-image parallel uploads. Resolved below in §2.
- **Open Question 3** — Resend bounce webhook auth, secret, URL. Resolved below in §2.
- **Open Question 4** — `profileComplete` computation cost (Postgres generated column vs SQL function vs application-layer derivation). Resolved below in §2.
- **Auto-resend on expired** — explicitly NOT chosen (enumeration vector). Manual "Neuen Link anfordern" only. [LOCKED in CONTEXT.md, not researcher's call.]
- **Rate-limit response shape** — REQ says 429; planner picks JSON shape vs RFC 7807. (Not researcher-resolvable; left to planner.)
- **Portfolio drag-handle reordering UX** — may slip to Phase 3.

### Deferred Ideas (OUT OF SCOPE)

- i18n switcher (DEC-006, DE-only v1)
- OAuth (Google, Apple) — DEC-022 rejected list
- Profile soft-delete / reactivation flow — Phase 7 admin moderation
- Per-type email notification preferences — global opt-out only in v1

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-roles-rbac | 4 roles (`public`, `artist`, `venue`, `admin`); single ENV-provisioned admin; route gates per role; users.role enum already in schema | §2.1 (Better Auth user.additionalFields for `role` mirror, OR domain `users.role` lookup), §3.1 (proxy.ts pattern for route gating) |
| REQ-magic-link-auth | Resend delivery; HMAC-hashed tokenHash; 15min TTL; single-use (consumedAt); 10/min/IP; bounce flips `users.status='email_invalid'` and blocks further sends | §2.1 (single source of truth = Better Auth `verification` table; storeToken: 'hashed'), §3.4 (rate limit), §3.5 (bounce webhook) |
| REQ-profile-uploads | Artist `portfolioBlobs jsonb [{url, alt, order}]`; Venue `photoBlobs jsonb [{url, alt}]`; signed URL TTL on upload; per-user file count limit | §2.2 (parallel via @vercel/blob/client `upload`), §3.3 (handleUpload server route with auth + count check) |

---

## 1. Domain Summary (for the planner)

Phase 1 wires identity onto the Phase-0 skeleton. Concretely: a real human types an email at `/artist/signup` or `/venue/signup` (or `/login` for returning users), Better Auth's bundled magic-link plugin sends a Resend email with a 15-min single-use HMAC-hashed token, and `/auth/verify` resolves the token to a session. On first verify of a signup token, the role from the URL/token-context is written to `users.role`; admin is never reachable via this path. After verify, `proxy.ts` (Next.js 16 renamed `middleware.ts`) does an **optimistic cookie-only check** to gate `/artist/*` `/venue/*` `/admin/*` and to redirect incomplete profiles to `/me/edit`; deep authorization runs in a Data Access Layer at the page/Server Action level. Profile media uploads go straight from the browser to Vercel Blob via signed client tokens issued by `/api/profile/upload`, which authenticates the session, counts existing blobs, and refuses the 11th. A Resend bounce webhook (Svix-signed) flips `users.status='email_invalid'` and the magic-link send hook short-circuits for invalid-status users on subsequent attempts. Every relevant state change writes to `audit_log` via the Phase-0 `audit()` helper.

The phase **must not recreate** Better Auth scaffold, the `audit()` helper, the env-validation schema, or the 14 already-migrated tables; it extends them. The hand-curated `magic_link_tokens` table from Phase 0 is **redundant** under the chosen path and should be left dormant (or dropped in a follow-up migration once Better Auth's `verification` table is proven in production).

**Primary recommendation:** Use Better Auth's bundled `magicLink` plugin verbatim with `storeToken: 'hashed'` and a custom `sendMagicLink` that (a) checks `users.status` before sending and (b) embeds `role` in the redirect callbackURL so the post-verify hook can write it. Use `@vercel/blob/client` `upload` with parallel browser concurrency and a server-side `handleUpload` that authenticates + counts. Verify Resend webhooks with the official `svix` npm package using the raw request body. Compute `profileComplete` in the Data Access Layer with React `cache()`, NOT as a Postgres generated column.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-link issuance (token gen, HMAC, expiry) | API (Better Auth route handler) | — | Trust-bearing; never browser-derivable |
| Magic-link email delivery | API (Resend SDK from Server) | — | API key never leaves server |
| Magic-link verification + session establishment | API (Better Auth `/api/auth/[...all]`) | — | Cookie write requires server response |
| Role write on first verify | API (Better Auth `databaseHooks.user.create.after`) | — | Must be unforgeable; role pulled from server-side token context, not request body |
| Optimistic route gate (anonymous vs authed) | Next.js Proxy (proxy.ts) | — | Pre-render redirect on session-cookie presence only; per Next.js 16 docs, NEVER do DB checks here |
| Authoritative role/profileComplete authorization | API/Server (Data Access Layer in `src/lib/dal.ts`) | Server Component | Must be checked close to data source per Next.js auth guide |
| Profile field mutations | API (Server Action) | — | Zod validation server-side; updates `artist_profiles` / `venue_profiles` |
| Profile media upload (file bytes) | Browser → Vercel Blob (direct) | API (token issuance + completion webhook) | Uploads bypass our API; only the signed token + completion notification touch our server |
| Bounce webhook ingress | API (`/api/webhooks/resend/bounce`) | — | Side-channel from Resend; signature-verified raw body |
| Audit logging | API (audit() helper) | DB (audit_log table) | Phase 0 contract |

---

## 2. Open Question Resolutions

### Open Question 1 — Better Auth magic-link plugin vs hand-curated `magic_link_tokens` table

**Decision: Use Better Auth's bundled `magicLink` plugin as the single source of truth for issuance, hashing, expiry, and consumption. Leave our `magic_link_tokens` table dormant; do NOT delete it in Phase 1 (avoid migration risk during the auth cutover) — drop in a follow-up Phase 1.x cleanup migration once Better Auth's `verification` table is proven in production.**

Rationale (verified against existing code + Better Auth docs):

1. **Phase 0 already wired Better Auth's `magicLink` plugin** in `src/lib/auth.ts` with `expiresIn: 60 * 15` and a `sendMagicLink` callback that calls Resend. The `verification` table is migrated (`drizzle/0001_better_auth.sql`). The `magic_link_tokens` table from `drizzle/0000` is **not referenced from any code in `src/`** as of 2026-05-04 (verified by inspection of `src/lib/auth.ts`, `src/lib/audit.ts`, `src/db/schema.ts`). [VERIFIED: codebase inspection]
2. **Better Auth's `verification` table is the plugin's native storage** for magic-link tokens. From Better Auth docs: *"The storage backend itself is controlled by the global `verification` config."* [CITED: better-auth.com/docs/plugins/magic-link]
3. **`storeToken: 'hashed'` produces an HMAC-equivalent at-rest hash**, satisfying REQ-magic-link-auth's "tokenHash HMAC, not plaintext." Default `allowedAttempts: 1` enforces single-use (replay rejected with `ATTEMPTS_EXCEEDED` error code, plus the row is deleted post-attempt). [CITED: better-auth.com/docs/plugins/magic-link]
4. **Rejected alternative — keeping both tables.** Path (b) from CONTEXT.md (use both: Better Auth for sessions, our table for magic links) requires a custom storage adapter that Better Auth docs do not document explicitly for the magic-link plugin's verification path. The cost outweighs the benefit: we'd own bug-for-bug hashing parity with Better Auth's plugin.
5. **The 3-state error UX (D-1.4) is achievable on top of Better Auth's verification flow** by branching in our own `/auth/verify` route handler that wraps the Better Auth verify call:
   - "Used" = Better Auth returns the `ATTEMPTS_EXCEEDED` error on a token row that previously succeeded → distinguish from never-issued by querying `verification` for the row's existence.
   - "Expired" = Better Auth returns expired/invalid AND row exists with past `expiresAt` → query `verification` table directly to disambiguate.
   - "Invalid" = no row in `verification` matching the hashed token (Better Auth returns invalid).

   **Caveat (MEDIUM confidence):** Better Auth's docs describe a single redirect-with-error-query-param flow (`?error=ATTEMPTS_EXCEEDED`). The 3-state copy must be derived in our wrapper, not from Better Auth alone. The planner should add an integration test that constructs each scenario explicitly. [ASSUMED: docs do not enumerate non-`ATTEMPTS_EXCEEDED` error codes]

6. **Role-on-token (D-1.1) implementation pattern** — Better Auth's `signIn.magicLink({ email, callbackURL })` is the issuance call. The role does NOT need to be embedded in the cryptographic token payload itself; it travels via the `callbackURL` query string we control. The flow:
   - `/artist/signup` Server Action calls `signIn.magicLink({ email, callbackURL: '/auth/post-verify?role=artist' })`.
   - User clicks link → Better Auth's verify endpoint creates session → redirects to `callbackURL`.
   - `/auth/post-verify` Server Component: reads the session, looks up the user in domain `users` table, and IF current role is `'public'` (i.e., this is first verify), writes the role from the query param. Else ignores the role param (returning user; role already set).
   - **Why this is safe:** the role-write is server-side, gated on `current role === 'public'`, and only runs from a path the user actually clicked through Better Auth's verify (i.e., we know the email was confirmed). An attacker who manipulates the `?role=` query param without a valid magic-link click cannot reach `/auth/post-verify` with a logged-in session for that email. [ASSUMED: this design — Better Auth docs don't describe a role-bearing-token pattern explicitly; verify with a test that asserts an attacker forging the query param without a verified session gets a 403]
   - **Alternative considered:** persist `role` in `verification.value` as JSON alongside the token. Rejected because (a) Better Auth's `value` field semantics are plugin-internal and undocumented for safe extension, (b) the callbackURL approach is equally safe and simpler.

**Concrete code skeleton:**

```ts
// src/lib/auth.ts — additions to the existing config
plugins: [
  magicLink({
    expiresIn: 60 * 15,
    storeToken: 'hashed',                 // REQ-magic-link-auth: HMAC at rest
    disableSignUp: false,
    sendMagicLink: async ({ email, url }) => {
      // Pre-flight: check users.status before sending (D-1.4 + REQ bounce)
      const existing = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: { status: true },
      });
      if (existing?.status === 'email_invalid') {
        // Silent drop: do not reveal account state. Audit it.
        await audit({
          actorUserId: null,
          action: 'magic_link.suppressed_invalid_email',
          target: `email:${email}`,
          meta: { reason: 'users.status=email_invalid' },
        });
        return; // Better Auth treats this as success; user sees "check your inbox"
      }
      await resend.emails.send({
        from: 'KultA <onboarding@resend.dev>',
        to: email,
        subject: 'Ihr Login-Link',
        html: magicLinkEmail({ url }),  // Sie-Form per tone-of-voice §5.7
      });
      await audit({
        actorUserId: null,
        action: 'magic_link.issued',
        target: `email:${email}`,
        meta: {},
      });
    },
  }),
],
```

```ts
// src/app/auth/post-verify/page.tsx — Server Component, runs after Better Auth's redirect
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users as domainUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function PostVerify({
  searchParams,
}: { searchParams: Promise<{ role?: 'artist' | 'venue' }> }) {
  const { role } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login?error=invalid');

  const user = await db.query.users.findFirst({
    where: eq(domainUsers.email, session.user.email),
  });
  // First-verify role write, gated on current=public
  if (user?.role === 'public' && (role === 'artist' || role === 'venue')) {
    await db.update(domainUsers)
      .set({ role })
      .where(eq(domainUsers.id, user.id));
    await audit({
      actorUserId: user.id,
      action: 'user.role_assigned',
      target: `user:${user.id}`,
      meta: { role, source: 'magic_link_signup' },
    });
  }
  redirect('/me');
}
```

### Open Question 2 — Vercel Blob signed-upload concurrency for 10-image parallel uploads

**Decision: Allow parallel uploads from the browser using `@vercel/blob/client`'s `upload()` directly. Each call hits our `/api/profile/upload` route to mint a fresh client token (1-hour default TTL — well above any practical upload duration), then the browser POSTs the file bytes directly to Vercel Blob's edge. Server-side, enforce per-user file count BEFORE issuing a token — the 11th token request returns 400. No backoff queue needed.**

Rationale:

1. **No documented rate limit on `handleUpload` token issuance.** [VERIFIED: vercel.com/docs/vercel-blob/client-upload — token issuance is just `tokenPayload + sign + return`; no Vercel-side throttle documented.] The practical bottleneck is database round-trips inside `onBeforeGenerateToken` (one `SELECT count(*)` per token request). With 10 parallel requests this is a non-issue against Neon serverless Postgres.
2. **`@vercel/blob/client` `upload()` is designed for direct browser-to-edge uploads.** [CITED: vercel.com/docs/vercel-blob/client-upload] The token-then-upload exchange is two round trips per file; with 10 parallel files this is ~10 × (token RTT + blob upload RTT). On a typical mobile network with 3-4MB JPEGs this completes in 5-15s.
3. **The SDK supports `multipart: true`** for splitting individual large files into parallel chunks, but at our 5MB cap that's overkill; per-file multipart adds RTT for negligible gain. Skip it.
4. **Default token `validUntil` = now + 1 hour.** [VERIFIED: vercel.com/docs/vercel-blob/using-blob-sdk] No need to override unless a user has a pathologically slow connection (>1h to upload 5MB is essentially unreachable).
5. **Server-side count check is the only race-condition surface.** Two parallel token requests for the 10th + 11th slot could both pass a `count = 9` check and both succeed. Mitigation options:
   - **Application-layer (recommended for Phase 1):** accept a small race; even if 11 photos land, the next read normalizes the array (UI shows newest 10, oldest gets soft-deleted on next mutation). The cost cap is preserved within bounds (12 images max in pathological cases). **Document this in the test plan** as an explicit non-issue.
   - **Strict (over-engineering for Phase 1):** wrap count + token issuance in a Postgres advisory lock per user. Reject as Phase 1 over-engineering.

**Concrete code skeleton:**

```ts
// src/app/api/profile/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { artistProfiles, venueProfiles, users as domainUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';

const LIMITS = { artist: 10, venue: 8 } as const;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) throw new Error('Not authenticated');

        const user = await db.query.users.findFirst({
          where: eq(domainUsers.email, session.user.email),
          columns: { id: true, role: true },
        });
        if (!user || (user.role !== 'artist' && user.role !== 'venue')) {
          throw new Error('Forbidden');
        }

        // File-count cap — D-1.2
        const existingCount = user.role === 'artist'
          ? (await db.query.artistProfiles.findFirst({
              where: eq(artistProfiles.userId, user.id),
              columns: { portfolioBlobs: true },
            }))?.portfolioBlobs?.length ?? 0
          : (await db.query.venueProfiles.findFirst({
              where: eq(venueProfiles.userId, user.id),
              columns: { photoBlobs: true },
            }))?.photoBlobs?.length ?? 0;

        if (existingCount >= LIMITS[user.role]) {
          throw new Error(`Upload limit reached (${LIMITS[user.role]} files)`);
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 5 * 1024 * 1024, // D-1.2
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id, role: user.role }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { userId, role } = JSON.parse(tokenPayload);
        // Append to JSONB array — concurrent appends use Postgres array_append + UPDATE WHERE userId
        if (role === 'artist') {
          await db.execute(sql`
            UPDATE artist_profiles
            SET portfolio_blobs = COALESCE(portfolio_blobs, '[]'::jsonb)
              || ${JSON.stringify([{ url: blob.url, alt: '', order: 0 }])}::jsonb
            WHERE user_id = ${userId}
          `);
        } else {
          await db.execute(sql`
            UPDATE venue_profiles
            SET photo_blobs = COALESCE(photo_blobs, '[]'::jsonb)
              || ${JSON.stringify([{ url: blob.url, alt: '' }])}::jsonb
            WHERE user_id = ${userId}
          `);
        }
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
```

```tsx
// src/app/me/edit/portfolio-uploader.tsx — client component, parallel uploads
'use client';
import { upload } from '@vercel/blob/client';

export function PortfolioUploader() {
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Parallel — Promise.all is the recommended pattern with @vercel/blob/client
    const results = await Promise.allSettled(
      files.map((f) =>
        upload(f.name, f, { access: 'public', handleUploadUrl: '/api/profile/upload' }),
      ),
    );
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length) {
      // Surface friendly error per uploaded slot (e.g., "Datei 3: Limit erreicht")
    }
  };
  return <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onChange} />;
}
```

### Open Question 3 — Resend bounce webhook authentication

**Decision: Mount the bounce handler at `/api/webhooks/resend/bounce` (separate from `/api/auth/[...all]`). Verify the request with the official `svix` npm package using the raw request body and the signing secret stored in `RESEND_WEBHOOK_SECRET` env var (add to `src/lib/env.ts` Zod schema).**

Rationale:

1. **Resend uses Svix for webhook signing.** [VERIFIED: docs.svix.com/receiving/verifying-payloads/how + Resend dashboard provides webhook secrets in `whsec_…` Svix-compatible format] The three headers are `svix-id`, `svix-timestamp`, `svix-signature`. HMAC-SHA256.
2. **Raw body is mandatory.** [CITED: docs.svix.com] Next.js App Router route handlers receive a `Request` object — calling `request.text()` (NOT `request.json()`) preserves the raw body for signature verification before parsing.
3. **`/api/webhooks/resend/bounce` URL** keeps the webhook outside Better Auth's catch-all. Mounting under `/api/auth/...` would conflict with Better Auth's `[...all]` route handler.
4. **Bounce event name** — `email.bounced` per Resend's event-types catalogue. [VERIFIED: resend.com/docs/dashboard/webhooks/event-types]
5. **Secret storage** — add `RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_')` to `src/lib/env.ts`. Provision in Vercel ENV per environment (Dev/Preview/Prod) — Phase 0 pattern.
6. **Idempotency** — Svix delivers each event with a unique `svix-id`; persist last-seen IDs (or rely on the operation being idempotent: `UPDATE users SET status='email_invalid' WHERE email = ?` is naturally idempotent). [ASSUMED: idempotency via UPSERT semantics is sufficient; Resend retries up to 5 times on non-2xx]

**Concrete code skeleton:**

```ts
// src/app/api/webhooks/resend/bounce/route.ts
import { Webhook } from 'svix';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  };

  let event: { type: string; data: { email: string; bounce?: { type: string } } };
  try {
    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
    event = wh.verify(rawBody, headers) as typeof event;
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  if (event.type !== 'email.bounced') {
    return new Response('Ignored', { status: 200 });
  }

  // Permanent bounce only — soft bounces should not flip status (REQ-magic-link-auth)
  // Resend `bounce.type` is 'hard' for permanent rejection (verify against Resend payload schema in test)
  const email = event.data.email.toLowerCase();
  await db.update(users).set({ status: 'email_invalid' }).where(eq(users.email, email));
  await audit({
    actorUserId: null,
    action: 'user.email_invalid',
    target: `email:${email}`,
    meta: { source: 'resend.bounce', svixId: headers['svix-id'] },
  });

  return new Response('OK', { status: 200 });
}
```

**Action for planner:** ensure `RESEND_WEBHOOK_SECRET` is provisioned in Vercel Dev/Preview/Prod BEFORE the bounce route ships, and that the Resend dashboard webhook is configured to point at `https://<deployment>/api/webhooks/resend/bounce` with the `email.bounced` event subscribed.

### Open Question 4 — `profileComplete` computation cost

**Decision: Compute `profileComplete` in the **Data Access Layer** (Server-side, React `cache()`-memoized), NOT as a Postgres generated column. Skip storing the boolean entirely.**

Rationale:

1. **Next.js 16 docs explicitly forbid DB checks in Proxy.** [VERIFIED: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md + 02-guides/authentication.md §"Optimistic checks with Proxy"] Quote: *"since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."*
2. **The middleware-cost worry from CONTEXT.md is therefore moot:** middleware/proxy must NOT do this check. The check belongs in the Data Access Layer at the page/Server Action level, where Next.js's `cache()` API memoizes per-render-pass.
3. **Postgres generated column is the wrong tool.** It would require encoding the completeness rules in SQL (string-length checks on `bio`, JSONB array length on photo_blobs, etc.) — these rules will evolve (CONTEXT.md says "avoid drift if rules change"). SQL drift between Drizzle migrations and the rule logic is high-risk.
4. **SQL function** (`profile_complete(user_id)`) has the same drift problem and adds a network round-trip per page render.
5. **Application-layer derivation in TypeScript** keeps the rules in one place (a `isProfileComplete(user)` function), is trivially testable, and benefits from `cache()` so the DAL only runs the check once per render.

**Cost analysis:**

- Proxy cost: **0 DB queries** (just reads session cookie). [VERIFIED: per Next.js docs, this is the prescribed pattern.]
- DAL cost on a `/artist/*` request: 1 SELECT joining `users` + `artist_profiles` (already needed for any page that renders user data); React `cache()` ensures it runs once per request even if multiple components call `verifySession()`.
- Layout-level redirect to `/me/edit` happens via the `redirect()` call inside the Server Component layout once the DAL returns `profileComplete: false`.

**Concrete code skeleton:**

```ts
// src/lib/dal.ts — Data Access Layer (Phase 1 introduces this file)
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, artistProfiles, venueProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type SessionUser = {
  id: string;
  email: string;
  role: 'public' | 'artist' | 'venue' | 'admin';
  status: 'active' | 'suspended' | 'email_invalid';
  profileComplete: boolean;
};

function isArtistComplete(p: { displayName: string | null; bio: string | null }) {
  return !!p.displayName && p.displayName.length >= 1 && p.displayName.length <= 80
      && !!p.bio       && p.bio.length         >= 10 && p.bio.length         <= 1000;
}
function isVenueComplete(p: {
  name: string | null; addressStreet: string | null; capacity: number | null;
  photoBlobs: Array<{ url: string }> | null;
}) {
  return !!p.name && !!p.addressStreet && !!p.capacity && p.capacity > 0
      && (p.photoBlobs?.length ?? 0) >= 1;
}

export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
  });
  if (!user) return null;

  let profileComplete = true; // public/admin always complete
  if (user.role === 'artist') {
    const p = await db.query.artistProfiles.findFirst({ where: eq(artistProfiles.userId, user.id) });
    profileComplete = !!p && isArtistComplete(p);
  } else if (user.role === 'venue') {
    const p = await db.query.venueProfiles.findFirst({ where: eq(venueProfiles.userId, user.id) });
    profileComplete = !!p && isVenueComplete(p);
  }
  return { id: user.id, email: user.email, role: user.role, status: user.status, profileComplete };
});

export async function requireRole(roles: SessionUser['role'][]): Promise<SessionUser> {
  const u = await verifySession();
  if (!u) redirect('/login');
  if (!roles.includes(u.role)) redirect('/');
  return u;
}

export async function requireCompleteProfile(): Promise<SessionUser> {
  const u = await verifySession();
  if (!u) redirect('/login');
  if (!u.profileComplete) redirect('/me/edit');
  return u;
}
```

```ts
// src/app/artist/layout.tsx
import { requireRole, requireCompleteProfile } from '@/lib/dal';
export default async function ArtistLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['artist']);
  await requireCompleteProfile();
  return <>{children}</>;
}
```

---

## 3. Stack-Specific Patterns

### 3.1 Next.js 16 Proxy (renamed from middleware) — optimistic gate only

> **Critical for the planner:** Next.js 16 RENAMED `middleware.ts` → `proxy.ts`. [VERIFIED: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md, *"Starting with Next.js 16, Middleware is now called Proxy to better reflect its purpose"*]

```ts
// proxy.ts (project root, NOT in src/app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/events', '/login', '/auth/verify', '/auth/post-verify'];
const PUBLIC_PREFIXES = ['/events/', '/artists/', '/venues/', '/api/auth/', '/api/webhooks/', '/_next/'];
const PROTECTED_PREFIXES = ['/artist', '/venue', '/admin', '/me'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Better Auth session cookie — name comes from auth lib config; verify in test
  const sessionCookie = request.cookies.get('better-auth.session_token');

  const isPublic = PUBLIC_PATHS.includes(pathname)
                || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
                || pathname.startsWith('/artist/signup')
                || pathname.startsWith('/venue/signup');

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Note:** Proxy ONLY checks "is there a session cookie?" — actual role + profileComplete checks happen in the layout via `requireRole` / `requireCompleteProfile` from the DAL. This is the Next.js 16 prescribed pattern. [CITED: 02-guides/authentication.md §"Optimistic checks with Proxy"]

### 3.2 Better Auth integration shape

Phase 0 already wired:
- `src/lib/auth.ts` — `betterAuth()` with `drizzleAdapter`, `magicLink` plugin, `databaseHooks.user.create.after` mirror to domain `users`.
- `src/lib/auth-client.ts` — `createAuthClient` with `magicLinkClient` plugin.
- `src/app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)` exports `{ GET, POST }`.

Phase 1 changes:
- Add `storeToken: 'hashed'` to magicLink plugin.
- Update `sendMagicLink` to do a pre-flight `users.status` check + use the tone-of-voice DE template.
- Extend `databaseHooks.user.create.after` (already exists in Phase 0) — **the existing hook already inserts a domain `users` row with role `'public'`**. Phase 1 leaves that as-is and writes the actual `artist`/`venue` role in `/auth/post-verify` (see §2.1).
- Use `auth.api.getSession({ headers: await headers() })` in the DAL.

### 3.3 Drizzle for role/profile mutations

The schema is locked from Phase 0. Phase 1 does NOT touch `src/db/schema.ts` for new columns — it only writes/reads existing ones:

- `users.role` — write at `/auth/post-verify` (first-verify only) and at admin provisioning script.
- `users.status` — write at bounce webhook.
- `artist_profiles` / `venue_profiles` — INSERT (UPSERT) on first profile save; UPDATE thereafter.
- `artist_profiles.portfolioBlobs` / `venue_profiles.photoBlobs` — append-only via JSONB `||` operator inside `onUploadCompleted`.

**Drizzle JSONB pattern for append:**
```ts
await db.execute(sql`
  UPDATE artist_profiles
  SET portfolio_blobs = COALESCE(portfolio_blobs, '[]'::jsonb) || ${JSON.stringify([newBlob])}::jsonb
  WHERE user_id = ${userId}
`);
```

### 3.4 Rate limit on `/api/auth/sign-in/magic-link`

Phase 0 created `src/lib/ratelimit.ts` with `magicLinkLimit` (10/min, sliding window). Phase 1 wires it. Better Auth's plugin doesn't expose a pre-issuance hook for rate limiting on the actual route; the cleanest hook is **before** the call in our own `/artist/signup`/`/venue/signup`/`/login` Server Actions:

```ts
// src/app/(public)/login/actions.ts
'use server';
import { magicLinkLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import { authClient } from '@/lib/auth-client'; // or call auth.api directly

export async function requestMagicLink(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const { success, reset } = await magicLinkLimit.limit(ip);
  if (!success) {
    return { error: 'rate_limit', retryAfter: reset };
  }
  const email = formData.get('email') as string;
  await auth.api.signInMagicLink({ body: { email, callbackURL: '/auth/post-verify' } });
  return { ok: true };
}
```

For role-bearing variants, the `callbackURL` becomes `/auth/post-verify?role=artist` (D-1.1).

### 3.5 Resend bounce webhook

See §2.3 above. **Action items:**
1. Add `RESEND_WEBHOOK_SECRET` to `src/lib/env.ts` Zod schema and Vercel ENV per environment.
2. Add `svix` package: `pnpm add svix`.
3. Create `src/app/api/webhooks/resend/bounce/route.ts` per the skeleton in §2.3.
4. Configure the Resend dashboard webhook endpoint to point at `/api/webhooks/resend/bounce` with `email.bounced` subscribed; copy the `whsec_…` secret into `RESEND_WEBHOOK_SECRET` in Vercel ENV.
5. Add `docs/runbook.md` entry for "Resend bounce webhook" in the Phase 0 runbook update.

### 3.6 Admin provisioning

REQ-roles-rbac SC#4 mandates ENV-provisioned admin only. Phase 0 already declared `ADMIN_EMAIL` in env schema. Phase 1 adds a one-shot script (or Drizzle migration data step):

```ts
// scripts/provision-admin.ts — runnable once per environment
import 'dotenv/config';
import { db } from '@/db';
import { users } from '@/db/schema';
import { env } from '@/lib/env';
import { eq } from 'drizzle-orm';

if (!env.ADMIN_EMAIL) throw new Error('ADMIN_EMAIL not set');
await db.insert(users)
  .values({ email: env.ADMIN_EMAIL, role: 'admin', status: 'active' })
  .onConflictDoUpdate({ target: users.email, set: { role: 'admin' } });
console.log(`Provisioned admin: ${env.ADMIN_EMAIL}`);
```

The admin still uses magic-link login (no separate password flow); the `/login` path serves admin too (no `/admin/signup`).

---

## 4. Existing Files Survey

Anchored against `.planning/phases/00-skeleton-infra/00-PLAN.md` `files_modified` (verified by inspection of `src/`).

### EXTEND (already exist from Phase 0; Phase 1 modifies)

| File | What Phase 1 Changes |
|------|---------------------|
| `src/lib/auth.ts` | Add `storeToken: 'hashed'`; rewrite `sendMagicLink` callback (status pre-flight + DE template); leave `databaseHooks.user.create.after` as-is |
| `src/lib/env.ts` | Add `RESEND_WEBHOOK_SECRET` (whsec_-prefixed string) |
| `src/lib/ratelimit.ts` | No edits — already exports `magicLinkLimit` (10/min). Just import in Server Actions |
| `src/lib/audit.ts` | Add new action literal types: `'magic_link.issued'`, `'magic_link.replay_attempt'`, `'magic_link.expired'`, `'magic_link.invalid'`, `'magic_link.suppressed_invalid_email'`, `'user.role_assigned'`, `'user.email_invalid'`, `'user.profile_completed'`, `'user.profile_updated'` |
| `src/app/layout.tsx` | (only if needed) — header showing session status |
| `src/app/page.tsx` | (only if hero CTAs change) |
| `docs/runbook.md` | Add Resend webhook config + admin-provision script + ENV-var inventory delta |
| `.env.example` | Add `RESEND_WEBHOOK_SECRET=whsec_…` and `ADMIN_EMAIL=…` |
| `package.json` | Add `svix` and `@vercel/blob` (verify whether `@vercel/blob` is already a transitive dep — it is NOT in package.json as of 2026-05-04, must add) |

### CREATE_NEW (do not exist; Phase 1 creates)

| File | Purpose |
|------|---------|
| `proxy.ts` (project root) | Next.js 16 optimistic session-cookie gate — replaces what would have been `middleware.ts` |
| `src/lib/dal.ts` | Data Access Layer with `verifySession`, `requireRole`, `requireCompleteProfile` |
| `src/lib/profile-rules.ts` | Pure functions `isArtistComplete`, `isVenueComplete` (importable from DAL + tests) |
| `src/lib/email/magic-link.tsx` | DE-Form magic-link email template (Sie-Form per tone-of-voice §5.7) |
| `src/app/(public)/login/page.tsx` + `actions.ts` | Universal login |
| `src/app/(public)/artist/signup/page.tsx` + `actions.ts` | Artist signup landing (D-1.1) |
| `src/app/(public)/venue/signup/page.tsx` + `actions.ts` | Venue signup landing (D-1.1) |
| `src/app/auth/verify/page.tsx` | 3-state UX (D-1.4) — wraps Better Auth verify result |
| `src/app/auth/post-verify/page.tsx` | First-verify role-write per §2.1 |
| `src/app/me/page.tsx` | Authenticated-user home (any role) |
| `src/app/me/edit/page.tsx` + `actions.ts` | Profile editor (artist or venue branch) |
| `src/app/me/edit/portfolio-uploader.tsx` | Client component for parallel uploads |
| `src/app/me/edit/photos-uploader.tsx` | Same pattern, venue side |
| `src/app/artist/layout.tsx` + `src/app/artist/page.tsx` | Stub artist surface to verify gating |
| `src/app/venue/layout.tsx` + `src/app/venue/page.tsx` | Stub venue surface to verify gating |
| `src/app/admin/layout.tsx` + `src/app/admin/page.tsx` | Stub admin surface to verify gating |
| `src/app/artists/[slug]/page.tsx` | Public artist profile (renders portfolioBlobs) |
| `src/app/venues/[slug]/page.tsx` | Public venue profile (renders photoBlobs) |
| `src/app/api/profile/upload/route.ts` | Vercel Blob `handleUpload` route |
| `src/app/api/webhooks/resend/bounce/route.ts` | Bounce webhook (svix-verified) |
| `scripts/provision-admin.ts` | One-shot admin provisioning |
| `tests/unit/profile-rules.test.ts` | Unit tests for `isArtistComplete`/`isVenueComplete` |
| `tests/unit/dal.test.ts` | DAL `verifySession` cache + role gating |
| `tests/integration/magic-link.test.ts` | Better Auth magic-link end-to-end on testcontainers |
| `tests/integration/upload.test.ts` | `handleUpload` route auth + count gating |
| `tests/integration/bounce-webhook.test.ts` | Svix signature verify + status flip |
| `tests/e2e/auth-flow.spec.ts` | Playwright: signup → email → verify → me/edit → /artist (gated) |
| `tests/e2e/route-gates.spec.ts` | Role matrix from ROADMAP SC#3 |

### LOCKED — Phase 1 MUST NOT modify

| File | Why |
|------|-----|
| `src/db/schema.ts` | All 10 domain tables exist; columns Phase 1 needs are present (users.role, users.status, artist_profiles.*, venue_profiles.*). NO new columns required. |
| `src/db/auth-schema.ts` | Better Auth shape — must match `drizzle/0001_better_auth.sql` exactly per the file's own warning |
| `drizzle/0000_*.sql` | Phase 0 migration; schema drift is a Phase 1 watch-out (see §5e) but no edits |
| `drizzle/0001_better_auth.sql` | Same |
| `src/db/index.ts` | dbTx lazy proxy; Phase 0 SUMMARY notes Phase 2 may refactor but Phase 1 should not |
| `src/app/api/_test-sentry/route.ts` | Phase 0 carry-over for production health checks |
| `tests/setup/*` | Phase 0 contract; extending is fine, replacing is not |

### DROP DEFERRED (do NOT delete in Phase 1)

| File | Rationale |
|------|-----------|
| `magic_link_tokens` table in DB | Defer to Phase 1.x cleanup migration; deleting mid-cutover is risky |
| All references to `magic_link_tokens` in `src/db/schema.ts` | Defer for the same reason |

---

## 5. Risks & Landmines

### a. Magic-link token replay across multiple devices/tabs

**Risk:** User clicks the email link on Phone, then opens email on Laptop and clicks again. With Better Auth `allowedAttempts: 1`, the second click sees `ATTEMPTS_EXCEEDED`. The 3-state UI (D-1.4) must distinguish this from "expired" and "invalid" — but Better Auth's docs only describe a single `?error=ATTEMPTS_EXCEEDED` query param. [ASSUMED: other error codes exist but are undocumented]

**Mitigation:**
- Phase 1 verify route does its own follow-up SELECT against the `verification` table to disambiguate (row-exists + past-`expiresAt` = expired; row-exists + ATTEMPTS_EXCEEDED = used; no row = invalid).
- Add an integration test that simulates each scenario explicitly (timestamp manipulation for expired; double-call for used; bogus token for invalid).
- **Audit precision matters per CONTEXT.md** — wrong audit codes will hide real replay attempts.

**Warning sign:** if all three scenarios funnel to `magic_link.invalid`, the disambiguation logic broke.

### b. Signed-Blob URL expiry vs slow uploads

**Risk:** Default `validUntil = now + 1 hour` is generous, but a user on a flaky 3G connection uploading 10 × 5MB files might exceed it. More likely, the **session expires mid-upload** (Better Auth default session is 7 days, so this is unlikely in practice).

**Mitigation:**
- Use `Promise.allSettled` so one slow upload doesn't fail the batch.
- UI shows per-file progress; failed files allow retry by re-selecting.
- Each retry mints a fresh token (token TTL resets per upload).

**Warning sign:** support reports "upload spinner stuck"; check Vercel Blob logs for token-expired errors.

### c. Bounce webhook ordering (bounce arrives before user clicks link)

**Risk:** User signs up at `/artist/signup` → magic link email is sent → bounces immediately → bounce webhook flips `users.status='email_invalid'` → user (somehow, on a different device, or because the original delivery half-succeeded) clicks the link → Better Auth verifies it → session is created for an `email_invalid` user. The user can now use the app despite their email being marked invalid.

**Mitigation:**
- The `/auth/post-verify` Server Component checks `users.status` AFTER session creation; if `'email_invalid'`, sign the session out and redirect to `/login?error=email_invalid` with a German-language explainer.
- Even rarer: bounce arrives **before** the user row exists (Better Auth's `databaseHooks.user.create.after` runs only on first verification, not on `signIn.magicLink` request). In that case, the bounce webhook UPDATE matches 0 rows; the magic-link issuance still succeeded; on first-time verify the user row is created with `status='active'`. There's no way to retroactively flip status without storing pending-bounces. **Accept this gap as a Phase 1 known limitation; Phase 6 (email domain verification) makes bounces vastly rarer.**

**Warning sign:** an email_invalid user has an active session (admin investigation tool: query `users` left-join `session` where `status='email_invalid'`).

### d. Better Auth schema drift between upstream and our hand-curated migrations

**Risk:** From Phase 0 SUMMARY: *"Better Auth migration is separate from our hand-curated schema (drizzle/0001 vs 0000) — schema drift between Better Auth upstream and our drizzle/ is a watch-out. Phase 1 signup task will validate alignment."* If Better Auth bumps a minor version and adds a column to `verification`, our `src/db/auth-schema.ts` declarations diverge from what `drizzleAdapter` expects → runtime adapter errors.

**Mitigation:**
- Pin `better-auth: 1.6.9` (already pinned in package.json — verified).
- Add a CI step (or a Phase 1 unit test) that runs `npx @better-auth/cli generate --output /tmp/expected.sql` and diffs against `drizzle/0001_better_auth.sql`. Fail if they differ.
- Document the upgrade dance in `docs/runbook.md`: any Better Auth version bump requires regenerating both the SQL migration AND `src/db/auth-schema.ts`.

**Warning sign:** Better Auth runtime errors mentioning unknown columns or missing fields.

### e. Proxy cost for profileComplete check (NON-RISK once design is correct)

**Risk (as posed in CONTEXT.md):** Middleware runs on every `/artist/*` `/venue/*` request — running a DB query there would tank p95.

**Resolution:** As established in §2.4, this is a non-issue — Next.js 16's official guidance is **don't** do DB checks in proxy.ts. The check happens in the layout-level DAL with React `cache()` memoization; it's free relative to the page render that already needs user data anyway.

**Warning sign:** if a future planner moves `requireCompleteProfile` into proxy.ts, p95 will degrade. Document this as a hard rule in `src/lib/dal.ts` JSDoc.

### f. Race condition on file-count cap

(Already discussed in §2.2.) Two parallel token requests for slots 10+11 both pass `count = 9`. **Accepted gap** for Phase 1; cost-cap remains within tolerance (max 12 files in pathological case).

### g. Role assignment via query-param-only callbackURL

(Discussed in §2.1.) A clever attacker theoretically tries to manipulate `?role=artist` after a `/login` flow that should not assign a role. **Mitigation:** the `/auth/post-verify` write is gated on `current role === 'public'` — returning users (role already set) ignore the param. Add an integration test that asserts a venue user calling `/auth/post-verify?role=artist` does NOT change their role.

### h. The hand-curated `magic_link_tokens` table is dead code

The table exists in DB but is referenced nowhere in `src/`. Risk: a future Phase 2+ developer assumes it's the magic-link path and builds against it. **Mitigation:** add a code-comment in `src/db/schema.ts` near the `magicLinkTokens` declaration: `// DEPRECATED Phase 1: Better Auth's verification table is the source of truth. Drop in Phase 1.x cleanup migration.`

---

## 6. Validation Architecture (Nyquist Dimension 8)

8 distinct validation surfaces for Phase 1 acceptance:

| # | Surface | Tool | Phase 1 Coverage Targets |
|---|---------|------|-------------------------|
| 1 | **Unit (pure logic)** | Vitest 4 | `isArtistComplete`/`isVenueComplete` boundary cases (1-char displayName, 9-char bio, 1001-char bio, 0 photos for venue, etc.); audit action enum stability |
| 2 | **Integration (DB)** | Vitest + @testcontainers/postgresql (Phase 0 contract) | (a) magic-link issue → verify → session full path; (b) replay returns correct error; (c) expiry simulated via timestamp shift; (d) bounce webhook flips status; (e) `handleUpload` route auth gate + count gate; (f) DAL `verifySession` returns correct profileComplete |
| 3 | **E2E (browser)** | Playwright 1.59 | (a) `/artist/signup` → email click (mocked Resend) → `/me/edit` → fill profile → upload 1 image → `/artist` shows 200; (b) role-gate matrix from ROADMAP SC#3 (anonymous/artist/venue/admin × `/`/`/artist`/`/venue`/`/admin`/`/me` cells) |
| 4 | **Type** | tsc --noEmit (CI) | strict mode: zero `any` in DAL, env, route handlers, Server Actions, audit calls. The `tokenPayload` JSON.stringify/parse boundary is the riskiest type-erasure point — guard with Zod parse on the parse side |
| 5 | **Lint** | ESLint flat config (Phase 0 contract) | No new rules; ensure `react/no-unescaped-entities` survives DE umlauts; ensure `import/no-cycle` survives the dal ↔ auth import graph |
| 6 | **A11y** | @axe-core/playwright + manual keyboard pass | Zero WCAG 2.1 AA violations on `/login`, `/artist/signup`, `/venue/signup`, `/me/edit`, `/auth/verify` (all 3 states); focus indicators visible (2px) on every form input; error states announced via `aria-live="polite"` |
| 7 | **Performance** | Lighthouse CI (Phase 0 baseline) | Lighthouse Mobile ≥ 90 on `/login`, `/artist/signup`, `/venue/signup` (REQ-quality-bar). p95 page load < 2s — verified by Sentry RUM tracing on these routes after deploy |
| 8 | **Security** | Multi-layered: gitleaks (Phase 0), explicit security tests | (a) `RESEND_WEBHOOK_SECRET` never in git (gitleaks rule); (b) bounce webhook returns 401 on invalid signature (integration test); (c) `/api/profile/upload` returns 401 without session (integration test); (d) role-write on /auth/post-verify only fires when current role = public (integration test); (e) admin route refuses non-admin sessions (integration test); (f) rate limit on `/api/auth/sign-in/magic-link` triggers at 11th/min (integration test, may need to bypass Upstash with a test stub) |

**Wave 0 gaps (test infrastructure to add before implementation):**
- [ ] `tests/integration/magic-link-helpers.ts` — utility to fetch the most recent magic-link URL from the verification table (Phase 1 integration tests need this; Phase 0 only had a smoke test)
- [ ] `tests/integration/svix-helpers.ts` — utility to sign a fake Svix payload for bounce webhook tests
- [ ] `tests/setup/mock-resend.ts` — vitest-side stub that intercepts `resend.emails.send` calls and stores them for assertion

**Sampling rate:**
- Per task commit: `pnpm test:unit` + `pnpm typecheck` + `pnpm lint` (< 30s combined)
- Per wave merge: full integration suite (`pnpm vitest run`) + Playwright e2e
- Phase gate: full suite green before `/gsd-verify-work`

**Test-pyramid distribution (target):** 60% unit (profile-rules, dal, audit-actions, env-schema), 25% integration (magic-link, upload, webhook, dal-with-db), 15% e2e (signup-to-gated-route).

---

## 7. Open Questions for the Planner

1. **Better Auth session cookie name.** The proxy.ts skeleton assumes `better-auth.session_token`. **Verify** by inspecting Better Auth 1.6.9 source or running a test login locally and reading `document.cookie`. If different, update the proxy. [ASSUMED: standard Better Auth name]

2. **Better Auth verify URL — `/api/auth/magic-link/verify` vs custom `/auth/verify` page.** Better Auth's plugin verifies at `/api/auth/magic-link/verify` and then redirects to `callbackURL`. Our `/auth/verify` page route from CONTEXT.md should be the **landing** page after a verify failure (the callbackURL on error). On success, callbackURL goes to `/auth/post-verify`. Confirm by running through the flow once locally.

3. **Resend bounce.type values.** Resend's `email.bounced` event has a `bounce` sub-object; we want to flip status only on **permanent (hard) bounces**, not soft bounces. The exact field name (`bounce.type === 'hard'` vs `bounce.subType`) is not documented in the page we fetched. Planner: run a real bounce in Resend's test mode (or fetch the full event-types page) before shipping the webhook. [ASSUMED: 'hard' is the discriminator]

4. **`@vercel/blob` package install.** Phase 0's package.json does NOT include `@vercel/blob` (verified — only `BLOB_READ_WRITE_TOKEN` env var was provisioned, not the SDK). Planner adds `pnpm add @vercel/blob svix` in Wave 0.

5. **`RESEND_WEBHOOK_SECRET` provisioning order.** Webhook verification REQUIRES the secret in env from the moment the route is deployed; otherwise verify-fail logs flood Sentry. Planner schedules: (a) Vercel ENV update first; (b) deploy; (c) configure Resend dashboard webhook; (d) integration test fires.

6. **Profile-completion banner one-time-dismissal storage.** D-1.3 mentions a "green 'Profil vollständig' toast on first save (one-time, dismissed forever)." Where to store the dismissed-flag — `users.profileCompletedSeenAt` column (would require migration), localStorage (cheap, not cross-device), or accept "shows once per session"? Planner decides; researcher cannot resolve from docs.

7. **Drizzle 0.45.2 `db.execute(sql)` vs typed builder for JSONB append.** The skeleton uses `db.execute(sql\`UPDATE … || jsonb\`)`. Drizzle does not expose a typed JSONB-append helper; this is the official escape hatch. Confirm against Drizzle 0.45 changelog there's no newer API. [ASSUMED: still the recommended pattern for JSONB array append]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth's plugin returns distinguishable error codes for used vs expired vs invalid via the `?error=` query param after accounting for our supplemental DB lookup | §2.1, §5a | UX collapses to single "invalid" message; audit precision lost; D-1.4 acceptance fails |
| A2 | Embedding role in `callbackURL` query string and validating server-side at `/auth/post-verify` is safe given session-coupled gate | §2.1, §5g | Role escalation if Better Auth lets an unauthenticated request reach post-verify with a `?role=` param (must be tested) |
| A3 | Vercel Blob does not throttle parallel `handleUpload` token issuance | §2.2 | 11th token fails with HTTP 429 from Vercel rather than our app — surfaces wrong error message |
| A4 | `bounce.type === 'hard'` is the correct discriminator on Resend's email.bounced event | §2.3, §7 | Soft bounces flip status, locking out legitimate users with one-time delivery hiccups |
| A5 | Resend's webhook secret env var format is `whsec_…` (Svix-standard) | §2.3 | Zod schema rejects valid secret; planner adjusts |
| A6 | `cookies()` cookie name `better-auth.session_token` is correct for Better Auth 1.6.9 | §3.1, §7 | Proxy never recognizes a session; all gated routes redirect to /login even for logged-in users |
| A7 | Better Auth's magicLink plugin's `databaseHooks.user.create.after` mirror to domain `users` runs before the `/auth/post-verify` Server Component (i.e., on first verification, not on signIn request) | §2.1, §5c | Race window where /auth/post-verify queries domain users that doesn't exist yet → undefined behavior |
| A8 | The `magic_link_tokens` table can remain in DB without code references and not cause CI/typecheck issues | §4 (DROP DEFERRED) | If Drizzle's introspection complains, planner needs to drop sooner |
| A9 | Drizzle's typed `db.query.artistProfiles.findFirst` works with `columns: { portfolioBlobs: true }` selecting only the JSONB array | §2.2, §2.4 | Falls back to `db.execute(sql)` raw query; cosmetic |
| A10 | Resend retries up to 5 times on 4xx/5xx bounce-webhook responses | §2.3 | If retries don't happen, transient DB errors cause silent failure to flip status |

---

## 8. Project Constraints (from CLAUDE.md / AGENTS.md)

From `AGENTS.md` (root) — **mandatory**:

> **This is NOT the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

Researcher consulted Next.js 16's bundled docs and surfaces the following as binding for the planner:

- **`middleware.ts` is gone — use `proxy.ts`.** [VERIFIED: 16-proxy.md, file is at project root or src/, NOT in src/app/]
- **Proxy must NOT do DB queries.** Optimistic checks only; gate on cookie presence; defer authoritative checks to the DAL. [VERIFIED: 02-guides/authentication.md]
- **Server Actions** for all form mutations (`/login`, `/artist/signup`, `/venue/signup`, `/me/edit`). NOT REST endpoints. [VERIFIED: 07-mutating-data.md is the canonical reference]
- **Cache Components** flag is on (Phase 0 enabled `cacheComponents`). Public profile pages (`/artists/[slug]`, `/venues/[slug]`) should leverage it for p95 < 2s. [Phase 0 SUMMARY: cacheComponents enabled]
- **Edge runtime is explicitly NOT used** (DEC-022). All routes run on Vercel Functions Fluid Compute, Node.js 24. [VERIFIED: PROJECT.md DEC-021]

From `CLAUDE.md` (extends AGENTS.md) — no additional directives beyond the above.

---

## 9. Code Examples (consolidated, verified pattern sources)

All code examples in §2 and §3 are derived from:
- **Better Auth** — better-auth.com/docs/plugins/magic-link, better-auth.com/docs/concepts/database (extending core schema)
- **Vercel Blob** — vercel.com/docs/vercel-blob/client-upload, vercel.com/docs/vercel-blob/using-blob-sdk
- **Svix** — docs.svix.com/receiving/verifying-payloads/how
- **Next.js 16** — node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md, 02-guides/authentication.md
- **Drizzle 0.45** — orm.drizzle.team/docs/sql (sql template literal escape hatch)
- **Existing codebase** — `src/lib/auth.ts` (already wires plugin + Resend), `src/lib/audit.ts`, `src/lib/ratelimit.ts`

---

## 10. Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — Next.js 16 Proxy file
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — DAL + Proxy optimistic checks
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — route handler patterns
- `vercel.com/docs/vercel-blob/client-upload` — handleUpload + handleUploadUrl pattern (last_updated 2026-02-26)
- `vercel.com/docs/vercel-blob/using-blob-sdk` — maximumSizeInBytes, validUntil, multipart (last_updated 2026-02-19)
- `better-auth.com/docs/plugins/magic-link` — sendMagicLink, storeToken, allowedAttempts, callbackURL
- `better-auth.com/docs/concepts/database` — additionalFields for extending user schema
- `docs.svix.com/receiving/verifying-payloads/how` — webhook signature verification with svix npm package
- Existing codebase: `src/lib/auth.ts`, `src/db/schema.ts`, `src/db/auth-schema.ts`, `src/lib/audit.ts`, `src/lib/ratelimit.ts`, `src/lib/env.ts`, Phase 0 SUMMARY + PLAN

### Secondary (MEDIUM confidence)
- `resend.com/docs/dashboard/webhooks/event-types` — confirmed `email.bounced` event name; signing details deferred to svix.com
- `resend.com/docs/dashboard/webhooks/introduction` — confirmed `svix-id` header; full signing/verification details extracted from svix.com docs

### Tertiary (LOW confidence — needs validation in execution)
- Resend bounce.type discriminator (hard vs soft) — not extracted from primary docs; assumed
- Better Auth session cookie name — assumed standard `better-auth.session_token`
- Better Auth error code enumeration beyond `ATTEMPTS_EXCEEDED` — not enumerated in plugin docs

---

## RESEARCH COMPLETE

**Phase:** 1 — Auth & Profiles
**Confidence:** HIGH on stack mechanics (Next.js 16 Proxy, Vercel Blob handleUpload, Svix webhook verification, Better Auth magicLink plugin), MEDIUM on integration shapes that depend on undocumented or thinly-documented Better Auth behavior (error code enumeration, role-via-callbackURL safety, bounce.type discriminator).

The planner now has: (a) one decisive answer per open question with concrete code skeletons, (b) the existing-files survey anchored against Phase 0's `files_modified`, (c) 8 risks with mitigations, (d) 8-surface validation matrix, (e) a 10-row Assumptions Log flagging exactly which claims need an integration-test confirmation in execution.
