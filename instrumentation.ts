// instrumentation.ts — Next.js Instrumentation Hook (stable in Next.js 15+/16).
// This file is loaded once by the Next.js server runtime before the first request.
// It imports the appropriate Sentry config file based on the runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime is disabled per DEC-022; this branch is a defensive no-op.
    await import('./sentry.edge.config');
  }
}
