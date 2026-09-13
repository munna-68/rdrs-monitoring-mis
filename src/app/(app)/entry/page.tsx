import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, homeFor } from '@/lib/roles';
import { getDb, schema } from '@/lib/db';
import { asc } from 'drizzle-orm';
import { listEntries } from '@/lib/entries';
import { EntryForm, type ActivityOption, type ProjectOption } from './entry-form';
import { Badge, Card, CardTitle, Empty, PageHeader, Stat, fmtBDT, fmtDate, fmtInt } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function EntryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can.submit(session.role)) redirect(homeFor(session.role));

  const db = await getDb();
  const [projectRows, activityRows] = await Promise.all([
    db.select().from(schema.projects).orderBy(asc(schema.projects.name)),
    db.select().from(schema.activities).orderBy(asc(schema.activities.projectId), asc(schema.activities.serialNumber)),
  ]);

  const projects: ProjectOption[] = projectRows.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  const activities: ActivityOption[] = activityRows.map((a) => ({
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

  const mine = await listEntries({ owner: { name: session.name, branch: session.branch } });
  const totalBeneficiaries = mine.reduce((s, e) => s + e.total, 0);
  const totalExpenditure = mine.reduce((s, e) => s + (e.actualExpenditure ?? 0), 0);

  return (
    <>
      <PageHeader
        title="New entry"
        subtitle={
          <>
            Submitting as <strong className="font-medium text-ink">{session.name}</strong> ·{' '}
            {session.branch} branch. Every row you save is attributed to this name, designation and
            branch.
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="My submissions" value={fmtInt(mine.length)} />
        <Stat label="Beneficiaries recorded" value={fmtInt(totalBeneficiaries)} accent="var(--chart-1)" />
        <Stat label="Expenditure recorded" value={fmtBDT(totalExpenditure)} accent="var(--chart-3)" />
      </div>

      <EntryForm projects={projects} activities={activities} />

      <div className="mt-6">
        <Card>
          <CardTitle
            title="My submissions"
            subtitle="Entries you have submitted from this branch. Read-only — corrections go through an Admin."
          />
          {mine.length === 0 ? (
            <Empty
              title="Nothing submitted yet"
              body="Your saved entries will appear here, newest first."
            />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Project</th>
                    <th className="py-2 pr-3 font-medium">Activity</th>
                    <th className="py-2 pr-3 text-right font-medium">Expenditure</th>
                    <th className="py-2 pr-3 text-right font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((e) => (
                    <tr key={e.id} className="border-b border-line/70 last:border-0">
                      <td className="tabular py-2 pr-3 whitespace-nowrap">{fmtDate(e.entryDate)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{e.project?.name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="text-ink-faint">{e.activity?.serialNumber}.</span>{' '}
                        {e.activity?.name ?? '—'}
                      </td>
                      <td className="tabular py-2 pr-3 text-right whitespace-nowrap">
                        {fmtBDT(e.actualExpenditure)}
                      </td>
                      <td className="tabular py-2 pr-3 text-right font-medium">{fmtInt(e.total)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {e.lastEditedAt ? (
                          <Badge tone="amber">Corrected {fmtDate(e.lastEditedAt)}</Badge>
                        ) : (
                          <Badge tone="neutral">Submitted</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
