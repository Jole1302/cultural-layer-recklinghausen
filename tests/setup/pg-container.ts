import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export type TestContext = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: TestDb;
};

export async function startPgWithMigrations(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return { container, pool, db };
}

export async function stopPg(ctx: TestContext): Promise<void> {
  await ctx.pool.end();
  await ctx.container.stop();
}
