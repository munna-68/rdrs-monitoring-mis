import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, homeFor } from '@/lib/roles';
import { getEntryById } from '@/lib/entries';
import { Badge, Button, Card, CardTitle, PageHeader, fmtBDT, fmtDate, fmtDateTime, fmtInt } from '@/components/ui';
import { EditForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can.editEntry(session.role)) redirect(homeFor(session.role));

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const entry = await getEntryById(id);
  if (!entry) notFound();

  const a = entry.activity;

  return (
    <>
      <PageHeader
        title="Correct entry"
        subtitle={
          <>
            Entry #{entry.id} — originally submitted by{' '}
            <strong className="font-medium text-ink">{entry.submittedByName}</strong> (
            {entry.submittedByDesignation}, {entry.branch} branch) on {fmtDate(entry.createdAt as unknown as Date)}.
          </>
        }
        right={
          <Link href="/records">
            <Button variant="secondary">Back to records</Button>
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Current total</p>
          <p className="tabular mt-1 text-[22px] font-semibold leading-none">{fmtInt(entry.total)}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Current expenditure</p>
          <p className="tabular mt-1 text-[22px] font-semibold leading-none">
            {fmtBDT(entry.actualExpenditure)}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Correction history</p>
          <p className="mt-1 text-[13px] leading-snug text-ink">
            {entry.lastEditedAt ? (
              <>
                Last corrected by <strong className="font-medium">{entry.lastEditedByName}</strong>
                <span className="block text-[11.5px] text-ink-faint">{fmtDateTime(entry.lastEditedAt)}</span>
              </>
            ) : (
              <span className="text-ink-soft">Never corrected</span>
            )}
          </p>
        </Card>
      </div>

      {entry.lastEditedAt && (
        <div className="mb-5">
          <Card>
            <CardTitle
              title="Previous correction"
              right={<Badge tone="amber">Audit</Badge>}
            />
            <p className="text-[13px] text-ink-soft">
              {entry.lastEditedByName}
              {entry.lastEditedByDesignation ? ` · ${entry.lastEditedByDesignation}` : ''} corrected this
              entry on {fmtDateTime(entry.lastEditedAt)}. The prototype records only the most recent
              correction — a full audit history is out of scope for this pass.
            </p>
          </Card>
        </div>
      )}

      <EditForm
        id={entry.id}
        entryDate={entry.entryDate}
        actualExpenditure={entry.actualExpenditure}
        counts={{
          female26: entry.female26,
          male26: entry.male26,
          pwd26: entry.pwd26,
          youthFemale: entry.youthFemale,
          youthMale: entry.youthMale,
          youthPwd: entry.youthPwd,
          girl: entry.girl,
          boy: entry.boy,
          pwd14: entry.pwd14,
        }}
        readOnlyContext={[
          { label: 'Project', value: entry.project?.name ?? null },
          { label: 'Activity code', value: a?.activityCode ?? null },
          { label: 'Serial no.', value: a ? String(a.serialNumber) : null },
          { label: 'Activity', value: a?.name ?? null },
          { label: 'Unit type', value: a?.unitType ?? null },
          { label: 'Intervention', value: a?.intervention ?? null },
          { label: 'Activity type', value: a?.activityType ?? null },
          { label: 'Unit rate (BDT)', value: a?.unitRate === null || a?.unitRate === undefined ? null : fmtBDT(a.unitRate) },
          { label: 'Project target', value: a?.projectTarget === null || a?.projectTarget === undefined ? null : fmtInt(a.projectTarget) },
          { label: 'Project budget (BDT)', value: a?.projectBudget === null || a?.projectBudget === undefined ? null : fmtBDT(a.projectBudget) },
        ]}
      />
    </>
  );
}
