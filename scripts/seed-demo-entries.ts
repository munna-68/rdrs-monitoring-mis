/**
 * Generates sample entries so the dashboard and Records table have something to
 * show during an internal demo.
 *
 *   npm run seed:demo             # replace any previous sample data
 *   npm run seed:demo -- --purge  # remove all sample data and stop
 *
 * Everything it writes is flagged `is_sample = true`, which is the only thing
 * that distinguishes it from a real submission — so it can be identified in the
 * UI and purged in one command before the prototype is pointed at live data.
 *
 * Generation is deterministic (seeded PRNG), so re-running produces the same
 * figures and screenshots stay reproducible.
 */
import { closeDb, getDb, schema } from '../src/lib/db';
import { eq, asc } from 'drizzle-orm';

const PURGE_ONLY = process.argv.includes('--purge');

/** mulberry32 — small, fast, reproducible. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20240630);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

/** RDRS works across the Rangpur division — these are its operational districts. */
const BRANCHES = ['Rangpur', 'Dinajpur', 'Kurigram', 'Nilphamari', 'Lalmonirhat', 'Thakurgaon'];

const OFFICERS = [
  'Rahima Begum', 'Abdul Karim', 'Shahida Akter', 'Mizanur Rahman',
  'Nasrin Sultana', 'Jahangir Alam', 'Farida Yasmin', 'Sohel Rana',
];

/** The workbook's reporting year. */
const FY = { startYear: 2023, startMonth: 7, months: 12 };

function monthKey(offset: number): { year: number; month: number; date: string } {
  const m0 = FY.startMonth - 1 + offset;
  const year = FY.startYear + Math.floor(m0 / 12);
  const month = (m0 % 12) + 1;
  const day = int(1, 28);
  return {
    year,
    month,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

async function main() {
  const db = await getDb();

  await db.delete(schema.entries).where(eq(schema.entries.isSample, true));
  console.log('Cleared previous sample entries.');

  if (PURGE_ONLY) {
    console.log('Purge complete — no sample data written.');
    return;
  }

  const projects = await db.select().from(schema.projects).orderBy(asc(schema.projects.id));
  const activities = await db.select().from(schema.activities).orderBy(asc(schema.activities.serialNumber));
  if (projects.length === 0 || activities.length === 0) {
    throw new Error('No projects/activities found. Run `npm run seed` first.');
  }

  const byProject = new Map<number, typeof activities>();
  for (const a of activities) {
    const list = byProject.get(a.projectId) ?? [];
    list.push(a);
    byProject.set(a.projectId, list);
  }

  type NewEntry = typeof schema.entries.$inferInsert;
  const rows: NewEntry[] = [];

  for (const branch of BRANCHES) {
    // Bigger branches file more entries.
    const perBranch = int(9, 16);
    for (let i = 0; i < perBranch; i++) {
      const project = pick(projects);
      const pool = byProject.get(project.id) ?? [];
      if (pool.length === 0) continue;
      const activity = pick(pool);

      const { year, month, date } = monthKey(int(0, FY.months - 1));
      const officer = pick(OFFICERS);

      // Plausible demographic mix: adults dominate, children smaller, PWDs few.
      const female26 = int(4, 46);
      const male26 = int(3, 38);
      const pwd26 = int(0, 5);
      const youthFemale = int(2, 34);
      const youthMale = int(1, 28);
      const youthPwd = int(0, 4);
      const girl = int(0, 24);
      const boy = int(0, 20);
      const pwd14 = int(0, 3);
      const total =
        female26 + male26 + pwd26 + youthFemale + youthMale + youthPwd + girl + boy + pwd14;

      const unitRate = activity.unitRate ?? 1000;
      const actualExpenditure = Math.round(unitRate * int(1, 6) * (0.85 + rng() * 0.3));

      const corrected = rng() < 0.12;

      rows.push({
        entryDate: date,
        month,
        year,
        projectId: project.id,
        activityId: activity.id,
        actualExpenditure,
        female26, male26, pwd26,
        youthFemale, youthMale, youthPwd,
        girl, boy, pwd14,
        total,
        submittedByName: officer,
        submittedByDesignation: 'Monitoring Officer',
        branch,
        submittedByRole: 'USER',
        isSample: true,
        lastEditedByName: corrected ? 'Admin (sample)' : null,
        lastEditedByDesignation: corrected ? 'Admin' : null,
        lastEditedAt: corrected ? new Date() : null,
      });
    }
  }

  // Insert in batches — a single 70-row insert is fine, but keeping it chunked
  // avoids one oversized statement on the embedded driver.
  const CHUNK = 40;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(schema.entries).values(rows.slice(i, i + CHUNK));
  }

  const correctedCount = rows.filter((r) => r.lastEditedAt).length;
  console.log(`Inserted ${rows.length} sample entries across ${BRANCHES.length} branches.`);
  console.log(`  ${correctedCount} flagged as corrected, ${rows.length - correctedCount} as submitted.`);
  console.log('All rows have is_sample = true. Remove with: npm run seed:demo -- --purge');
}

main()
  .then(async () => { await closeDb(); })
  .catch(async (e) => {
    console.error('\nDemo seed failed:\n', e);
    await closeDb().catch(() => {});
    process.exit(1);
  });
