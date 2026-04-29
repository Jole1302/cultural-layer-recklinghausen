import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

// In dev/test without Upstash, return an always-allow stub.
// Production deploys MUST have UPSTASH_REDIS_REST_URL set (validated by
// env.ts in Phase 1+ when this primitive is actually consumed).
const NOOP_LIMIT = {
  limit: async () => ({ success: true, limit: Infinity, remaining: Infinity, reset: 0 }),
} as unknown as Ratelimit;

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export const magicLinkLimit: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'), // REQ-magic-link-auth: 10/min/IP
      analytics: true,
      prefix: 'rl:magiclink',
    })
  : NOOP_LIMIT;

export const ticketRedeemLimit: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '60 s'), // REQ-qr-checkin-scanner: 50/min/venue
      analytics: true,
      prefix: 'rl:redeem',
    })
  : NOOP_LIMIT;
