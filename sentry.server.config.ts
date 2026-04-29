// sentry.server.config.ts — Sentry server-side instrumentation.
// Loaded by Next.js instrumentation hook (see instrumentation.ts).
// IMPORTANT: `init()` is a no-op when SENTRY_DSN is absent — safe in local dev.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: false,

  // Spotlight: local Sentry proxy for dev (optional; uncomment when using Spotlight)
  // spotlight: process.env.NODE_ENV === 'development',
});
