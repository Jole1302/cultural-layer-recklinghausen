// sentry.client.config.ts — Sentry client-side instrumentation.
// This file is loaded in the browser automatically by @sentry/nextjs.
// IMPORTANT: `init()` is a no-op when SENTRY_DSN is absent — safe in local dev
// before the Sentry project is created (T-27 verify step blocked on user Sentry account).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay session recording — enable only when SENTRY_DSN is set
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay: 10% in prod, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Reduce noise in development
  debug: false,
});
