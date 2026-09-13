/**
 * Applies the SQL migrations in ./drizzle to whichever Postgres is configured —
 * a real server via DATABASE_URL, or the embedded PGlite fallback. Same
 * migration files either way.
 *
 * Run with:  npm run db:migrate
 */
import path from 'node:path';
import { preparePgliteDataDir, pgliteDataDir } from '../src/lib/db/pglite-lock';

async function main() {
  const folder = path.join(process.cwd(), 'drizzle');
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
      import('postgres'),
      import('drizzle-orm/postgres-js'),
      import('drizzle-orm/postgres-js/migrator'),
    ]);
    console.log('Migrating against DATABASE_URL (postgres-js)…');
    const client = postgres(url, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.end();
    console.log('Migrations applied.');
    return;
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  const dataDir = pgliteDataDir();
  preparePgliteDataDir(dataDir);
  console.log(`Migrating against embedded Postgres (PGlite) at ${dataDir}…`);
  const client = new PGlite(dataDir);
  await client.waitReady;
  await migrate(drizzle(client), { migrationsFolder: folder });
  await client.close();
  console.log('Migrations applied.');
}

main().catch((e) => {
  console.error('\nMigration failed:\n', e);
  process.exit(1);
});
