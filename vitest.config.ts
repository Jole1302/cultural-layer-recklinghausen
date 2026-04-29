import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' throws when imported outside a React Server Components
      // runtime; tests run in plain Node, so swap to a no-op stub.
      'server-only': path.resolve(__dirname, './tests/setup/server-only-stub.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup/load-env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { lines: 0, functions: 0, statements: 0, branches: 0 },
    },
    sequence: { concurrent: false },
  },
});
