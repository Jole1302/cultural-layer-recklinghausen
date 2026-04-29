// @vitest-environment node
// Smoke test: Better Auth instance constructs and `getSession` returns null without throwing.
// This proves the schema-binding (Step 2) and Drizzle adapter wiring (Step 4) actually work at
// runtime, not just at typecheck time. If the adapter is misconfigured (missing schema, FK
// mismatch), this test crashes.
//
// Runs against the dev Neon DB (DATABASE_URL from .env.local). Does NOT use testcontainers —
// Better Auth's adapter is the integration we want to prove, and it needs a real connection
// where the 4 Better Auth tables already exist.
// Phase 1 will replace this with a full magic-link e2e flow.
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
