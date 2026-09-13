import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, homeFor } from '@/lib/roles';
import { getDb, schema } from '@/lib/db';
import { asc } from 'drizzle-orm';
import { listBranches, listEntries, type EntryFilters } from '@/lib/entries';
import { BENEFICIARY_COLUMNS } from '@/lib/tracking-headers';
import {
  Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Stat,
  fmtBDT, fmtDate, fmtInt,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

type Search = { projectId?: string; branch?: string; from?: string; to?: string };

/** Short column heads for the nine breakdown columns, in sheet order. */
const SHORT: Record<string, string> = {
  female26: 'F 26+',
  male26: 'M 26+',
  pwd26: 'PWD 26+',
  youthFemale: 'YF',
  youthMale: 'YM',
  youthPwd: 'YPWD',
  girl: 'Girl',
  boy: 'Boy',
  pwd14: 'PWD 0–14',
};

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const isOfficer = session.role === 'USER';
  if (!isOfficer && !can.viewAllEntries(session.role)) redirect(homeFor(session.role));

  const sp = await searchParams;
  const projectId = sp.projectId ? Number(sp.projectId) : undefined;

  const filters: EntryFilters = {
    projectId: Number.isFinite(projectId) && projectId ? projectId : undefined,
    branch: sp.branch?.trim() || undefined,
    dateFrom: sp.from?.trim() || undefined,
    dateTo: sp.to?.trim() || undefined,
    owner: isOfficer ? { name: session.name, branch: session.branch } : undefined,
  };

  const db = await getDb();
  const [projects, branches, entries] = await Promise.all([
    db.select().from(schema.projects).orderBy(asc(schema.projects.name)),
    listBranches(),
    listEntries(filters),
  ]);

  const canEdit = can.editEntry(session.role);

  const totalBeneficiaries = entries.reduce((s, e) => s + e.total, 0);
  const totalExpenditure = entries.reduce((s, e) => s + (e.actualExpenditure ?? 0), 0);

  // The download link reuses exactly the filters driving the table, so the
  // export can never silently disagree with what's on screen.
  const exportParams = new URLSearchParams();
  if (filters.projectId) exportParams.set('projectId', String(filters.projectId));
  if (filters.branch) exportParams.set('branch', filters.branch);
  if (filters.dateFrom) exportParams.set('from', filters.dateFrom);
  if (filters.dateTo) exportParams.set('to', filters.dateTo);
  const exportHref = `/api/export${exportParams.size ? `?${exportParams}` : ''}`;
  const exportHrefWithExtras = `${exportHref}${exportParams.size ? '&' : '?'}extras=1`;

  return (
    <>
      <PageHeader
        title="Records"
        subtitle={
          isOfficer
            ? 'Your own submissions. Download reproduces the Tracking sheet format exactly.'
            : 'All entries across branches and projects. Download reproduces the Tracking sheet format exactly.'
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <a href={exportHref}>
              <Button variant="primary">Download Excel</Button>
            </a>
            <a href={exportHrefWithExtras}>
              <Button variant="secondary">Download + submitter columns</Button>
            </a>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Entries in view" value={fmtInt(entries.length)} />
        <Stat label="Beneficiaries" value={fmtInt(totalBeneficiaries)} accent="var(--chart-1)" />
        <Stat label="Expenditure" value={fmtBDT(totalExpenditure)} accent="var(--chart-3)" />
      </div>

      <Card className="mb-5">
        <CardTitle
          title="Filters"
          subtitle="Filters apply to the table and to the Excel download together."
        />
        <form method="get" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Project">
            <Select name="projectId" defaultValue={sp.projectId ?? ''}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Branch">
            <Select name="branch" defaultValue={sp.branch ?? ''}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" name="from" defaultValue={sp.from ?? ''} />
          </Field>
          <Field label="To">
            <Input type="date" name="to" defaultValue={sp.to ?? ''} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            <Link href="/records"><Button type="button" variant="secondary">Reset</Button></Link>
          </div>
        </form>
      </Card>

      <Card padded={false}>
        {entries.length === 0 ? (
          <div className="p-5">
            <Empty
              title="No entries match these filters"
              body="Try widening the date range or clearing the project and branch filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[1600px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">M/Y</th>
                  <th className="px-3 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 font-medium">Activity</th>
                  <th className="px-3 py-2.5 font-medium">Branch</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expenditure</th>
                  {BENEFICIARY_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2.5 text-right font-medium whitespace-nowrap">
                      {SHORT[c.key] ?? c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-3 py-2.5 font-medium">Submitted by</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  {canEdit && <th className="px-3 py-2.5 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-line/70 last:border-0 hover:bg-canvas/60">
                    <td className="tabular px-3 py-2 whitespace-nowrap">{fmtDate(e.entryDate)}</td>
                    <td className="tabular px-3 py-2 whitespace-nowrap text-ink-soft">
                      {e.month}/{e.year}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.project?.name ?? '—'}</td>
                    <td className="max-w-[320px] px-3 py-2">
                      <span className="text-ink-faint">{e.activity?.serialNumber}.</span>{' '}
                      <span className="text-ink">{e.activity?.name ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.branch}</td>
                    <td className="tabular px-3 py-2 text-right whitespace-nowrap">
                      {fmtBDT(e.actualExpenditure)}
                    </td>
                    {BENEFICIARY_COLUMNS.map((c) => (
                      <td key={c.key} className="tabular px-2 py-2 text-right text-ink-soft">
                        {e[c.key] === 0 ? <span className="text-ink-faint">·</span> : fmtInt(e[c.key])}
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-right font-semibold">{fmtInt(e.total)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-ink">{e.submittedByName}</span>
                      <span className="block text-[11px] text-ink-faint">{e.submittedByDesignation}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {e.lastEditedAt ? (
                          <Badge tone="amber">Corrected by {e.lastEditedByName ?? '—'}</Badge>
                        ) : (
                          <Badge tone="neutral">Submitted</Badge>
                        )}
                        {e.isSample && <Badge tone="violet">Sample</Badge>}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/records/${e.id}/edit`}>
                          <Button variant="secondary" size="sm">Edit</Button>
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
        Download produces the 31 columns of the Tracking sheet, in its order, with its original
        header text — including “Varience” and the trailing spaces in “Project Name ” and
        “Annual Target ”. The second button appends branch and submitter columns after those 31 for
        internal follow-up.
      </p>
    </>
  );
}
