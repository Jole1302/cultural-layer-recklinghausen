// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { startPgWithMigrations, stopPg, type TestContext } from '../setup/pg-container';
import { audit } from '@/lib/audit';
import * as schema from '@/db/schema';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startPgWithMigrations();
}, 120_000);

afterAll(async () => {
  if (ctx) await stopPg(ctx);
});

describe('audit() helper (REQ-audit-log SC#4)', () => {
  it('audit() with actorUserId=null writes a system-action row', async () => {
    await audit(
      {
        actorUserId: null,
        action: 'event.bootstrap',
        target: 'event:test-1',
        meta: { reason: 'cold-start seed' },
      },
      ctx.db,
    );
    const rows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(isNull(schema.auditLog.actorUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('event.bootstrap');
    expect(rows[0]!.target).toBe('event:test-1');
    expect(rows[0]!.meta).toEqual({ reason: 'cold-start seed' });
  });

  it('audit() with a real actor writes action/target/meta correctly', async () => {
    const [u] = await ctx.db
      .insert(schema.users)
      .values({ email: 'admin@example.com', role: 'admin' })
      .returning();
    await audit(
      {
        actorUserId: u!.id,
        action: 'user.suspend',
        target: 'user:42',
        meta: { reason: 'spam' },
      },
      ctx.db,
    );
    const rows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'user.suspend'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorUserId).toBe(u!.id);
    expect(rows[0]!.target).toBe('user:42');
    expect(rows[0]!.meta).toEqual({ reason: 'spam' });
  });
});

describe('schema invariants', () => {
  it('events.capacity > 0 CHECK rejects 0', async () => {
    const [u] = await ctx.db
      .insert(schema.users)
      .values({ email: 'a@example.com', role: 'artist' })
      .returning();
    const [v] = await ctx.db
      .insert(schema.users)
      .values({ email: 'v@example.com', role: 'venue' })
      .returning();

    await expect(
      ctx.db.insert(schema.events).values({
        artistId: u!.id,
        venueId: v!.id,
        title: 'x',
        startAt: new Date(),
        capacity: 0,
      }),
    ).rejects.toThrow(/events_capacity_positive|capacity/);
  });

  it('events: status=published with artistAck=false fails the bilateral CHECK', async () => {
    const [u] = await ctx.db
      .insert(schema.users)
      .values({ email: 'a2@example.com', role: 'artist' })
      .returning();
    const [v] = await ctx.db
      .insert(schema.users)
      .values({ email: 'v2@example.com', role: 'venue' })
      .returning();

    await expect(
      ctx.db.insert(schema.events).values({
        artistId: u!.id,
        venueId: v!.id,
        title: 'y',
        startAt: new Date(),
        capacity: 50,
        status: 'published',
        artistAck: false,
        venueAck: true,
      }),
    ).rejects.toThrow(/events_published_iff_both_ack|published/);
  });

  it('tickets UNIQUE(eventId, userId) rejects duplicate', async () => {
    const [u] = await ctx.db
      .insert(schema.users)
      .values({ email: 'a3@example.com', role: 'artist' })
      .returning();
    const [v] = await ctx.db
      .insert(schema.users)
      .values({ email: 'v3@example.com', role: 'venue' })
      .returning();
    const [r] = await ctx.db
      .insert(schema.users)
      .values({ email: 'r@example.com', role: 'public' })
      .returning();
    const [e] = await ctx.db
      .insert(schema.events)
      .values({
        artistId: u!.id,
        venueId: v!.id,
        title: 'z',
        startAt: new Date(),
        capacity: 10,
      })
      .returning();

    await ctx.db.insert(schema.tickets).values({
      eventId: e!.id,
      userId: r!.id,
      qrHash: 'aaaa1111bbbb2222ccc33',
    });

    // Drizzle wraps the pg error; check the original via `cause.code` (23505 = unique_violation).
    let caught: unknown;
    try {
      await ctx.db.insert(schema.tickets).values({
        eventId: e!.id,
        userId: r!.id,
        qrHash: 'dddd4444eeee5555fff66',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    const cause = (caught as { cause?: { code?: string; constraint?: string } }).cause;
    expect(cause?.code).toBe('23505');
    expect(cause?.constraint).toBe('tickets_event_user_uq');
  });
});
