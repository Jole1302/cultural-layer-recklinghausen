import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Phase 1 will add Vercel Blob hosts; placeholder OK for now
    ],
  },
  // cacheComponents: foundation for REQ-quality-bar p95 < 2s NFR.
  // Actual perf is measured in T-32 (first deploy + Lighthouse).
  experimental: {
    cacheComponents: true,
  },
};

// withSentryConfig wraps the Next.js build to:
//   - inject Sentry client-side DSN via NEXT_PUBLIC_SENTRY_DSN
//   - upload source maps to Sentry on CI (requires SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT)
//   - add automatic Vercel monitor cron integration
//
// VERIFY STEP SKIPPED (T-27 partial): live "throw error and confirm Sentry receives"
// round-trip is blocked on user creating a Sentry account and providing SENTRY_DSN.
// Code is complete; verification deferred until DSN reaches Vercel ENV (T-27 checkpoint).
// DEC-019: Sentry from day 1 with P1 alerts to Telegram.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print Sentry build output in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (covers client-side files)
  widenClientFileUpload: true,

  // Suppress Sentry logger from production bundle
  disableLogger: true,

  // Auto-create Vercel cron monitors when `schedule` config is present
  automaticVercelMonitors: true,
});
