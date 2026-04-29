// Vitest setup: load .env.local into process.env before any module evaluates
// import * as schema (schema → @/lib/env eager-parses process.env).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip surrounding double-quotes emitted by `vercel env pull` (e.g. KEY="value")
    const raw_value = trimmed.slice(eq + 1).trim();
    const value =
      raw_value.startsWith('"') && raw_value.endsWith('"') ? raw_value.slice(1, -1) : raw_value;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
