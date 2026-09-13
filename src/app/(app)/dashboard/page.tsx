import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, homeFor } from '@/lib/roles';
import {
  activityRollups, branchRollups, dashboardSummary, demographicRollup,
  monthlyTrend, projectRollups,
} from '@/lib/dashboard';
import {
  AchievementByActivity, AchievementByProject, BranchCounts, DemographicBreakdown, ExpenditureTrend,
} from './charts';
import { Card, CardTitle, Empty, Notice, PageHeader, Stat, fmtBDT, fmtInt } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can.editEntry(session.role)) redirect(homeFor(session.role));

  const [summary, byProject, byActivity, trend, demographics, byBranch] = await Promise.all([
    dashboardSummary(),
    projectRollups(),
    activityRollups(12),
    monthlyTrend(),
    demographicRollup(),
    branchRollups(),
  ]);

  const empty = summary.entries === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live figures straight from submitted entries — nothing here is pre-aggregated or cached, so a new submission moves these charts immediately."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Entries" value={fmtInt(summary.entries)} />
        <Stat label="Beneficiaries" value={fmtInt(summary.beneficiaries)} accent="var(--chart-1)" />
        <Stat label="Expenditure" value={fmtBDT(summary.expenditure)} accent="var(--chart-3)" />
        <Stat label="Branches reporting" value={fmtInt(summary.branches)} accent="var(--chart-6)" />
        <Stat label="Corrected entries" value={fmtInt(summary.corrected)} accent="var(--chart-4)" />
      </div>

      {empty ? (
        <Empty
          title="No entries to chart yet"
          body={
            <>
              The charts appear as soon as entries exist. For a demo with realistic movement, run{' '}
              <code className="font-mono text-ink">npm run seed:demo</code> — it generates clearly
              labelled sample entries across branches and months.
            </>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle
                title="Achievement vs target, by project"
                subtitle="Recorded beneficiaries against the summed target of the activities actually reported on."
              />
              <AchievementByProject data={byProject} />
            </Card>

            <Card>
              <CardTitle
                title="Expenditure over time"
                subtitle="Monthly expenditure (line, left axis) with the number of entries filed (bars, right axis)."
              />
              <ExpenditureTrend data={trend} />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Card>
              <CardTitle
                title="Top activities by recorded achievement"
                subtitle="The twelve activities with the most recorded beneficiaries, against their own targets."
              />
              <AchievementByActivity data={byActivity} />
            </Card>

            <Card>
              <CardTitle
                title="Beneficiary demographics"
                subtitle="The nine breakdown columns summed across every entry in view."
              />
              <DemographicBreakdown data={demographics} />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Card>
              <CardTitle title="Branch-wise reporting" subtitle="Entry counts and beneficiary totals per branch." />
              <BranchCounts data={byBranch} />
            </Card>

            <Card>
              <CardTitle
                title="Project summary"
                subtitle="Achievement as a share of target — indicative only, since target and beneficiary count are not strictly the same unit."
              />
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 text-right font-medium">Entries</th>
                      <th className="py-2 pr-3 text-right font-medium">Achieved</th>
                      <th className="py-2 pr-3 text-right font-medium">Target</th>
                      <th className="py-2 pr-3 text-right font-medium">%</th>
                      <th className="py-2 pr-3 text-right font-medium">Expenditure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProject.map((p) => {
                      const pct = p.target > 0 ? Math.round((p.achievement / p.target) * 100) : null;
                      return (
                        <tr key={p.project} className="border-b border-line/70 last:border-0">
                          <td className="py-2 pr-3 font-medium">{p.project}</td>
                          <td className="tabular py-2 pr-3 text-right">{fmtInt(p.entries)}</td>
                          <td className="tabular py-2 pr-3 text-right">{fmtInt(p.achievement)}</td>
                          <td className="tabular py-2 pr-3 text-right text-ink-soft">{fmtInt(p.target)}</td>
                          <td className="tabular py-2 pr-3 text-right">
                            {pct === null ? <span className="text-ink-faint">—</span> : `${pct}%`}
                          </td>
                          <td className="tabular py-2 pr-3 text-right">{fmtBDT(p.expenditure)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Notice tone="warn">
                  Targets are summed only over activities that already have entries. Comparing against
                  the full project plan would make every project look far behind early in the period.
                </Notice>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
