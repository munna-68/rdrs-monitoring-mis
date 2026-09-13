import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, homeFor, type Role } from '@/lib/roles';
import { getDb, getDbInfo, schema } from '@/lib/db';
import { asc, sql } from 'drizzle-orm';
import { TRACKING_SOURCE, TRACKING_HEADER_COUNT } from '@/lib/tracking-headers';
import { CodePanel } from './code-panel';
import { MasterPanel, type AdminActivity, type AdminProject } from './master-panel';
import { Card, CardTitle, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can.manageCodes(session.role) && !can.manageMaster(session.role)) {
    redirect(homeFor(session.role));
  }

  const db = await getDb();
  const [codes, projectRows, activityRows, entryCount] = await Promise.all([
    db.select().from(schema.accessCodes),
    db.select().from(schema.projects).orderBy(asc(schema.projects.name)),
    db
      .select()
      .from(schema.activities)
      .orderBy(asc(schema.activities.projectId), asc(schema.activities.serialNumber)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.entries),
  ]);

  const projects: AdminProject[] = projectRows.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  const activities: AdminActivity[] = activityRows.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    activityCode: a.activityCode,
    serialNumber: a.serialNumber,
    name: a.name,
    unitType: a.unitType,
    intervention: a.intervention,
    activityType: a.activityType,
    unitRate: a.unitRate,
    projectTarget: a.projectTarget,
    projectBudget: a.projectBudget,
    annualTarget: a.annualTarget,
    annualBudget: a.annualBudget,
  }));

  const info = getDbInfo();

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Superadmin only. Manage the shared access codes and the project / activity master list that every entry draws its reference figures from."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Database driver</p>
          <p className="mt-1 font-mono text-[13px] text-ink">{info.driver}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{info.target}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Projects / activities</p>
          <p className="tabular mt-1 text-[20px] font-semibold leading-none">
            {projects.length} / {activities.length}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Entries recorded</p>
          <p className="tabular mt-1 text-[20px] font-semibold leading-none">
            {entryCount[0]?.n ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Export contract</p>
          <p className="tabular mt-1 text-[20px] font-semibold leading-none">
            {TRACKING_HEADER_COUNT} cols
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            from {TRACKING_SOURCE.sheet}!row {TRACKING_SOURCE.row}
          </p>
        </Card>
      </div>

      <div className="space-y-5">
        <CodePanel
          codes={codes.map((c) => ({
            role: c.role as Role,
            code: c.code,
            label: c.label,
            updatedAt: c.updatedAt,
          }))}
        />
        <MasterPanel projects={projects} activities={activities} />
      </div>
    </>
  );
}
