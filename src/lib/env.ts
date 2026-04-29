import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().startsWith('re_'),
  BLOB_READ_WRITE_TOKEN: z.string().startsWith('vercel_blob_rw_').optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ENABLE_BOOTSTRAP: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email().optional(),
  ENABLE_TEST_SENTRY: z.enum(['true', 'false']).default('false'),
  DEBUG_TOKEN: z.string().min(16).optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
