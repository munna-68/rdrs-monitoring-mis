import path from 'node:path';
import * as schema from './schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export type Database = PostgresJsDatabase<typeof schema>;
export type DbDriver = 'postgres-js' | 'pglite';

/**
 * Two drivers, one schema, one query API.
 *
 *  - `DATABASE_URL` set  -> `postgres-js` against a real Postgres server.
 *                           This is the production path: Vercel's
 *                           Storage/Marketplace tab provisions Neon and
 *                           injects DATABASE_URL automatically.
 *  - `DATABASE_URL` unset -> PGlite, which is PostgreSQL 16 compiled to
 *                           WebAssembly, persisted to a local directory.
 *                           This exists so the prototype can be cloned and
 *                           demoed with zero infrastructure — no Docker, no
 *                           local Postgres server, no signup. Same SQL, same
 *                           migrations, same types.
 *
 * Both expose an identical Drizzle interface, so nothing downstream needs to
 * know which one is live. `getDbInfo()` reports the active driver so the UI
 * can show it (useful when demoing to explain what you're looking at).
 */
const globalForDb = globalThis as unknown as {
  __rdrsDbPromise?: Promise<Database>;
  __rdrsDriver?: DbDriver;
};

async function createDb(): Promise<Database> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import('postgres'),
      import('drizzle-orm/postgres-js'),
    ]);
    // prepare:false keeps us compatible with Neon's pooled (PgBouncer)
    // connection string, which cannot support server-side prepared statements.
    const client = postgres(url, { max: 5, prepare: false });
    globalForDb.__rdrsDriver = 'postgres-js';
    return drizzle(client, { schema });
  }

  const [{ PGlite }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ]);
  const dataDir = process.env.PGLITE_DIR
    ? path.resolve(process.env.PGLITE_DIR)
    : path.join(process.cwd(), '.pglite-data');
  const client = new PGlite(dataDir);
  await client.waitReady;
  globalForDb.__rdrsDriver = 'pglite';
  // PGlite's Drizzle instance is structurally identical to the postgres-js
  // one for every query we issue; the cast just unifies the nominal type.
  return drizzle(client, { schema }) as unknown as Database;
}

export function getDb(): Promise<Database> {
  if (!globalForDb.__rdrsDbPromise) {
    globalForDb.__rdrsDbPromise = createDb();
  }
  return globalForDb.__rdrsDbPromise;
}

export function getDbInfo(): { driver: DbDriver; target: string } {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    // Never leak credentials into the UI — host only.
    let host = 'postgres';
    try {
      host = new URL(url).host;
    } catch {
      /* keep fallback */
    }
    return { driver: 'postgres-js', target: host };
  }
  return { driver: 'pglite', target: 'local embedded Postgres (.pglite-data)' };
}

export { schema };
