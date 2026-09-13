import type { Config } from 'drizzle-kit';

/**
 * `drizzle-kit generate` only needs the dialect and schema path — it diffs the
 * TypeScript schema and emits SQL, no live connection required. The
 * `dbCredentials` URL is only consulted by `push`/`studio`, so a placeholder is
 * fine when DATABASE_URL isn't set (the embedded-PGlite local path).
 */
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/rdrs',
  },
} satisfies Config;
