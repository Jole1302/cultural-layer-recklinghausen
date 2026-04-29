import 'server-only';
import { db as defaultDb } from '@/db';
import { auditLog } from '@/db/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/db/schema';

// Accept any Drizzle pg-dialect client that has the same schema bound.
// Production callers omit the second arg → `defaultDb` (Neon HTTP) is used.
// Tests pass the testcontainers `pg` client (NodePgDatabase) for parity with real Postgres.
export type AuditDb =
  | NeonHttpDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

export type AuditAction =
  | 'event.publish'
  | 'event.cancel'
  | 'event.bootstrap'
  | 'user.suspend'
  | 'user.activate'
  | 'ticket.redeem'
  | 'ticket.cancel';

export async function audit(
  params: {
    actorUserId: string | null; // null = system action per spec §6
    action: AuditAction | string;
    target: string; // e.g. 'event:42', 'user:abc-123'
    meta?: Record<string, unknown>;
  },
  db: AuditDb = defaultDb,
): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: params.actorUserId,
    action: params.action,
    target: params.target,
    meta: params.meta ?? {},
  });
}
