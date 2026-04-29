import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
import { env } from '@/lib/env';

// HTTP driver — fast, no pool, NO transactions.
// Use for: SELECT, single INSERT/UPDATE/DELETE without transaction guarantees.
const sqlHttp = neon(env.DATABASE_URL);
export const db = drizzleHttp(sqlHttp, { schema });

// WebSocket driver — supports transactions.
// Use for: capacity check (RSVP), double-ACK race (events publish), multi-statement audit.
// Lazy-init: only constructs pool if needed (saves cold-start ms when route doesn't transact).
neonConfig.webSocketConstructor = ws;
let _pool: Pool | null = null;
let _dbTx: ReturnType<typeof drizzleServerless<typeof schema>> | null = null;

function getDbTx() {
  if (!_dbTx) {
    _pool = new Pool({
      connectionString: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
    });
    _dbTx = drizzleServerless(_pool, { schema });
  }
  return _dbTx;
}

// Proxy export so call sites can use `dbTx.transaction(...)` directly.
export const dbTx = new Proxy({} as ReturnType<typeof getDbTx>, {
  get(_, prop) {
    const real = getDbTx() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema };
