import { getDb, schema } from './db';
import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { COL, TRACKING_HEADER_COUNT, BENEFICIARY_COLUMNS, type BeneficiaryKey } from './tracking-headers';

export type BeneficiaryCounts = Record<BeneficiaryKey, number>;

/** The nine counts, in sheet order, all zero. */
export function emptyCounts(): BeneficiaryCounts {
  return {
    female26: 0, male26: 0, pwd26: 0,
    youthFemale: 0, youthMale: 0, youthPwd: 0,
    girl: 0, boy: 0, pwd14: 0,
  };
}

/**
 * `Total` is always the sum of the nine beneficiary columns — never entered by
 * hand. Every write path goes through this so the stored total can't drift from
 * the components.
 */
export function computeTotal(c: BeneficiaryCounts): number {
  return BENEFICIARY_COLUMNS.reduce((sum, col) => sum + (Number(c[col.key]) || 0), 0);
}

export function countsFromEntry(e: Record<string, unknown>): BeneficiaryCounts {
  const out = emptyCounts();
  for (const col of BENEFICIARY_COLUMNS) {
    out[col.key] = Number(e[col.key] ?? 0) || 0;
  }
  return out;
}

/** Coerce arbitrary form input to a non-negative integer count. */
export function toCount(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function toAmount(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/* --------------------------- query + shaping --------------------------- */

export type EntryFilters = {
  projectId?: number;
  branch?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  /** When set, restrict to submissions made by this person at this branch. */
  owner?: { name: string; branch: string };
};

export type EntryWithRefs = Awaited<ReturnType<typeof listEntries>>[number];

export async function listEntries(filters: EntryFilters = {}) {
  const db = await getDb();
  const where: SQL[] = [];

  if (filters.projectId) where.push(eq(schema.entries.projectId, filters.projectId));
  if (filters.branch) where.push(eq(schema.entries.branch, filters.branch));
  if (filters.dateFrom) where.push(gte(schema.entries.entryDate, filters.dateFrom));
  if (filters.dateTo) where.push(lte(schema.entries.entryDate, filters.dateTo));
  if (filters.owner) {
    // PROTOTYPE NOTE: there is no user account, so "my submissions" is scoped by
    // the name+branch captured at login. Two officers sharing both a name and a
    // branch would see each other's rows — acceptable for a prototype, and it
    // disappears the moment real accounts exist.
    where.push(eq(schema.entries.submittedByName, filters.owner.name));
    where.push(eq(schema.entries.branch, filters.owner.branch));
  }

  return db.query.entries.findMany({
    where: where.length ? and(...where) : undefined,
    with: { project: true, activity: true },
    orderBy: [desc(schema.entries.entryDate), desc(schema.entries.id)],
  });
}

export async function getEntryById(id: number) {
  const db = await getDb();
  return db.query.entries.findFirst({
    where: eq(schema.entries.id, id),
    with: { project: true, activity: true },
  });
}

export async function listBranches(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ branch: schema.entries.branch })
    .from(schema.entries)
    .orderBy(asc(schema.entries.branch));
  return rows.map((r) => r.branch).filter(Boolean);
}

export async function countEntries(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.entries);
  return row?.n ?? 0;
}

/* ---------------------------- export shaping ---------------------------- */

export type TrackingCell = string | number | Date | null;

/**
 * Project one entry into the Tracking sheet's 31 columns, positionally.
 *
 * The array is indexed by the `COL` map (which is itself resolved from the
 * workbook's header row), and the length is asserted against the sheet — so a
 * reordered or renamed source column fails loudly here rather than silently
 * shifting every value one cell to the left in the export.
 *
 * Columns 17–20 (Last Quarter Target / Achievement, Varience, Budget) are
 * written as null: the app captures no source for them, and the source
 * workbook's own template leaves them blank. Inventing zeros there would be
 * worse than leaving them empty.
 */
export function toTrackingRow(e: EntryWithRefs): TrackingCell[] {
  const row: TrackingCell[] = new Array(TRACKING_HEADER_COUNT).fill(null);
  const a = e.activity;
  const p = e.project;

  row[COL.date] = parseISODateNoonUTC(e.entryDate);
  row[COL.month] = e.month;
  row[COL.year] = e.year;
  row[COL.project] = p?.name ?? '';
  row[COL.activityCode] = a?.activityCode ?? '';
  row[COL.serial] = a?.serialNumber ?? null;
  // The source template leaves "Project Name " blank; we fill it from the
  // project master because the app knows the value and the point of the tool is
  // to stop officers retyping things the master already holds.
  row[COL.projectName] = p?.name ?? '';
  row[COL.activityName] = a?.name ?? '';
  row[COL.unitType] = a?.unitType ?? null;
  row[COL.intervention] = a?.intervention ?? null;
  row[COL.activityType] = a?.activityType ?? null;
  row[COL.unitRate] = a?.unitRate ?? null;
  row[COL.projectTarget] = a?.projectTarget ?? null;
  row[COL.projectBudget] = a?.projectBudget ?? null;
  row[COL.annualTarget] = a?.annualTarget ?? null;
  row[COL.annualBudget] = a?.annualBudget ?? null;
  row[COL.lastQuarterTarget] = null;
  row[COL.lastQuarterAchievement] = null;
  row[COL.variance] = null;
  row[COL.budget] = null;
  row[COL.actualExpenditure] = e.actualExpenditure;
  row[COL.female26] = e.female26;
  row[COL.male26] = e.male26;
  row[COL.pwd26] = e.pwd26;
  row[COL.youthFemale] = e.youthFemale;
  row[COL.youthMale] = e.youthMale;
  row[COL.youthPwd] = e.youthPwd;
  row[COL.girl] = e.girl;
  row[COL.boy] = e.boy;
  row[COL.pwd14] = e.pwd14;
  row[COL.total] = e.total;

  if (row.length !== TRACKING_HEADER_COUNT) {
    throw new Error(`Tracking row has ${row.length} cells, expected ${TRACKING_HEADER_COUNT}.`);
  }
  return row;
}

/**
 * `entryDate` is a Postgres `date` and arrives as 'YYYY-MM-DD'. We anchor it at
 * noon UTC: Excel serials are computed from the timestamp, so midnight UTC would
 * render as the previous day for anyone in a negative UTC offset. Noon keeps the
 * calendar day stable across every real timezone.
 */
export function parseISODateNoonUTC(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}
