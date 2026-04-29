// Test-only stub for `server-only`. The real package throws on import
// outside of a React Server Components context; vitest runs in plain
// Node where that throw triggers spuriously. Production behavior is
// unchanged — only the vitest resolver swaps this in (vitest.config.ts).
export {};
