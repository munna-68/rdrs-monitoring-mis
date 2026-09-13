import { getDb, schema } from './db';
import { eq, sql, asc } from 'drizzle-orm';
import { BENEFICIARY_COLUMNS, type BeneficiaryKey } from './tracking-headers';

/**
 * All dashboard figures are computed in SQL from the live entries table — there
 * is no cached or pre-aggregated layer, so the charts move the moment a new
 * entry is submitted.
 *
 * NOTE ON "ACHIEVEMENT": the Tracking sheet's `Total` column is the recorded
 * beneficiary count, while `Project Target` is the activity's planned volume
 * from the master list. Comparing them is what the existing workbook does, so
 * we reproduce that comparison — but the two are not strictly the same unit,
 * and the dashboard labels the axis accordingly rather than implying precision
 * that isn't there.
 */

export type ProjectRollup = {
  project: string;
  entries: number;
  achievement: number;
  expenditure: number;
  target: number;
};

export async function projectRollups(): Promise<ProjectRollup[]> {
  const db = await getDb();

  const entryAgg = await db
    .select({
      project: schema.projects.name,
      entries: sql<number>`count(*)::int`,
      achievement: sql<number>`coalesce(sum(${schema.entries.total}), 0)::int`,
      expenditure: sql<number>`coalesce(sum(${schema.entries.actualExpenditure}), 0)::float8`,
    })
    .from(schema.entries)
    .innerJoin(schema.projects, eq(schema.entries.projectId, schema.projects.id))
    .groupBy(schema.projects.name);

  // Targets are summed only over activities that actually have entries —
  // otherwise the denominator is the whole project plan and every project looks
  // catastrophically behind on day one.
  const targetAgg = await db
    .select({
      project: schema.projects.name,
      target: sql<number>`coalesce(sum(${schema.activities.projectTarget}), 0)::float8`,
    })
    .from(schema.activities)
    .innerJoin(schema.projects, eq(schema.activities.projectId, schema.projects.id))
    .where(
      sql`${schema.activities.id} in (select distinct ${schema.entries.activityId} from ${schema.entries})`,
    )
    .groupBy(schema.projects.name);

  const targets = new Map(targetAgg.map((t) => [t.project, t.target]));

  return entryAgg.map((e) => ({
    project: e.project,
    entries: e.entries,
    achievement: e.achievement,
    expenditure: e.expenditure,
    target: Math.round(targets.get(e.project) ?? 0),
  }));
}

export type ActivityRollup = {
  label: string;
  project: string;
  achievement: number;
  target: number;
};

export async function activityRollups(limit = 12): Promise<ActivityRollup[]> {
  const db = await getDb();

  const rows = await db
    .select({
      name: schema.activities.name,
      serial: schema.activities.serialNumber,
      project: schema.projects.name,
      target: sql<number>`coalesce(${schema.activities.projectTarget}, 0)::float8`,
      achievement: sql<number>`coalesce(sum(${schema.entries.total}), 0)::int`,
    })
    .from(schema.entries)
    .innerJoin(schema.activities, eq(schema.entries.activityId, schema.activities.id))
    .innerJoin(schema.projects, eq(schema.entries.projectId, schema.projects.id))
    .groupBy(schema.activities.id, schema.activities.name, schema.activities.serialNumber, schema.projects.name, schema.activities.projectTarget)
    .orderBy(sql`coalesce(sum(${schema.entries.total}), 0) desc`)
    .limit(limit);

  return rows.map((r) => ({
    label: `${r.serial}. ${r.name.length > 42 ? `${r.name.slice(0, 42)}…` : r.name}`,
    project: r.project,
    achievement: r.achievement,
    target: Math.round(r.target),
  }));
}

export type MonthRollup = {
  key: string;
  label: string;
  year: number;
  month: number;
  entries: number;
  expenditure: number;
  beneficiaries: number;
};

export async function monthlyTrend(): Promise<MonthRollup[]> {
  const db = await getDb();
  const rows = await db
    .select({
      year: schema.entries.year,
      month: schema.entries.month,
      entries: sql<number>`count(*)::int`,
      expenditure: sql<number>`coalesce(sum(${schema.entries.actualExpenditure}), 0)::float8`,
      beneficiaries: sql<number>`coalesce(sum(${schema.entries.total}), 0)::int`,
    })
    .from(schema.entries)
    .groupBy(schema.entries.year, schema.entries.month)
    .orderBy(asc(schema.entries.year), asc(schema.entries.month));

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return rows.map((r) => ({
    key: `${r.year}-${String(r.month).padStart(2, '0')}`,
    label: `${MONTHS[r.month - 1] ?? r.month} ${String(r.year).slice(2)}`,
    year: r.year,
    month: r.month,
    entries: r.entries,
    expenditure: r.expenditure,
    beneficiaries: r.beneficiaries,
  }));
}

export type DemographicRollup = { key: BeneficiaryKey; label: string; value: number };

export async function demographicRollup(): Promise<DemographicRollup[]> {
  const db = await getDb();
  const selection: Record<string, ReturnType<typeof sql<number>>> = {};
  for (const c of BENEFICIARY_COLUMNS) {
    selection[c.key] = sql<number>`coalesce(sum(${schema.entries[c.key]}), 0)::int`;
  }

  const [row] = await db.select(selection).from(schema.entries);
  if (!row) return [];

  return BENEFICIARY_COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    value: Number((row as Record<string, number>)[c.key] ?? 0),
  }));
}

export type BranchRollup = { branch: string; entries: number; beneficiaries: number; expenditure: number };

export async function branchRollups(): Promise<BranchRollup[]> {
  const db = await getDb();
  const rows = await db
    .select({
      branch: schema.entries.branch,
      entries: sql<number>`count(*)::int`,
      beneficiaries: sql<number>`coalesce(sum(${schema.entries.total}), 0)::int`,
      expenditure: sql<number>`coalesce(sum(${schema.entries.actualExpenditure}), 0)::float8`,
    })
    .from(schema.entries)
    .groupBy(schema.entries.branch)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({
    branch: r.branch || '(not set)',
    entries: r.entries,
    beneficiaries: r.beneficiaries,
    expenditure: r.expenditure,
  }));
}

export async function dashboardSummary() {
  const db = await getDb();
  const [row] = await db
    .select({
      entries: sql<number>`count(*)::int`,
      beneficiaries: sql<number>`coalesce(sum(${schema.entries.total}), 0)::int`,
      expenditure: sql<number>`coalesce(sum(${schema.entries.actualExpenditure}), 0)::float8`,
      branches: sql<number>`count(distinct ${schema.entries.branch})::int`,
      corrected: sql<number>`count(${schema.entries.lastEditedAt})::int`,
    })
    .from(schema.entries);
  return row ?? { entries: 0, beneficiaries: 0, expenditure: 0, branches: 0, corrected: 0 };
}
