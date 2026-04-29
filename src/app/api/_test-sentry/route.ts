// src/app/api/_test-sentry/route.ts
// DEBUG ONLY — Phase 0 verification of Sentry pipeline. Disable post-Phase-0
// by setting ENABLE_TEST_SENTRY=false in prod Vercel ENV.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  // Gate 1: env flag — must be explicitly enabled; defaults to 'false' in env.ts
  if (env.ENABLE_TEST_SENTRY !== 'true') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  // Gate 2: token query param (T-0-05 SSRF/spam mitigation)
  const token = req.nextUrl.searchParams.get('token');
  if (!env.DEBUG_TOKEN || token !== env.DEBUG_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Throw a deliberately-shaped error Sentry will tag as P1.
  // After T-32 verification confirms Sentry → Telegram round-trip, set
  // ENABLE_TEST_SENTRY=false in Vercel prod ENV so this returns 404 in production.
  throw new Error('SENTRY_SMOKE_TEST: deliberate Phase 0 verification error');
}
