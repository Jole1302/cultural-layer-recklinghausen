// sentry.edge.config.ts — Sentry edge-runtime instrumentation stub.
// Per DEC-022, the Edge runtime is explicitly NOT used in this project.
// This file is a required placeholder so @sentry/nextjs does not emit a warning;
// it is effectively a no-op stub. Do not add any Edge-dependent code here.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Edge runtime is disabled (DEC-022); this stub satisfies @sentry/nextjs.
  tracesSampleRate: 0,

  debug: false,
});
