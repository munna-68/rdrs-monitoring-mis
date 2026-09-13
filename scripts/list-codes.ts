/**
 * Prints the current access codes. Useful for handing them out, and for
 * scripting (pass --json to emit machine-readable output).
 *
 * Run with:  npm run codes
 */
import { closeDb, getDb, schema } from '../src/lib/db';
import { asc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  const rows = await db.select().from(schema.accessCodes).orderBy(asc(schema.accessCodes.id));
  const order = ['USER', 'VIEW', 'ADMIN', 'SUPERADMIN'];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(sorted, null, 2));
    return;
  }

  if (sorted.length === 0) {
    console.log('No access codes found. Run `npm run seed` first.');
    return;
  }

  console.log('RDRS Monitoring MIS — access codes\n');
  for (const c of sorted) {
    console.log(`  ${c.role.padEnd(11)} ${c.code}`);
    console.log(`  ${' '.repeat(11)} ${c.label}\n`);
  }
}

main()
  .then(async () => { await closeDb(); })
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => {});
    process.exit(1);
  });
