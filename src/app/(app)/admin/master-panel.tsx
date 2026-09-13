'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  createActivityAction, createProjectAction, updateActivityAction, initialAdminState,
} from './actions';
import { Button, Card, CardTitle, Field, Input, Notice, Select, fmtBDT, fmtInt } from '@/components/ui';

export type AdminProject = { id: number; name: string; code: string };
export type AdminActivity = {
  id: number;
  projectId: number;
  activityCode: string;
  serialNumber: number;
  name: string;
  unitType: string | null;
  intervention: string | null;
  activityType: string | null;
  unitRate: number | null;
  projectTarget: number | null;
  projectBudget: number | null;
  annualTarget: number | null;
  annualBudget: number | null;
};

const ACTIVITY_FIELDS: {
  name: keyof AdminActivity; label: string; type?: 'text' | 'number'; hint?: string;
}[] = [
  { name: 'serialNumber', label: 'Serial no.', type: 'number' },
  { name: 'activityCode', label: 'Activity code' },
  { name: 'name', label: 'Activity name' },
  { name: 'unitType', label: 'Unit type' },
  { name: 'intervention', label: 'Intervention' },
  { name: 'activityType', label: 'Activity type' },
  { name: 'unitRate', label: 'Unit rate (BDT)', type: 'number' },
  { name: 'projectTarget', label: 'Project target', type: 'number' },
  { name: 'projectBudget', label: 'Project budget (BDT)', type: 'number' },
  { name: 'annualTarget', label: 'Annual target', type: 'number' },
  { name: 'annualBudget', label: 'Annual budget (BDT)', type: 'number' },
];

function ActivityFields({
  projectId,
  activity,
  hideProjectInput = false,
}: {
  projectId: number;
  activity?: AdminActivity;
  /** The "add activity" form renders its own project <select>, so it must not
   *  also emit a hidden projectId — two fields with the same name would make
   *  FormData.get() return the wrong one. */
  hideProjectInput?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {!hideProjectInput && <input type="hidden" name="projectId" value={projectId} />}
      {ACTIVITY_FIELDS.map((f) => {
        const raw = activity ? activity[f.name] : null;
        return (
          <Field key={String(f.name)} label={f.label} hint={f.hint}>
            <Input
              name={String(f.name)}
              type={f.type ?? 'text'}
              step={f.type === 'number' ? 'any' : undefined}
              required={f.name === 'name' || f.name === 'activityCode' || f.name === 'serialNumber'}
              defaultValue={raw === null || raw === undefined ? '' : String(raw)}
            />
          </Field>
        );
      })}
    </div>
  );
}

function ActivityRow({ activity }: { activity: AdminActivity }) {
  const [state, formAction, pending] = useActionState(updateActivityAction, initialAdminState);

  return (
    <tr className="border-b border-line/70 align-top last:border-0">
      <td className="tabular py-2 pr-3 text-ink-soft">{activity.serialNumber}</td>
      <td className="py-2 pr-3 font-mono text-[12px] text-ink-soft">{activity.activityCode}</td>
      <td className="py-2 pr-3">
        <span className="text-ink">{activity.name}</span>
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[12px] font-medium text-brand-700 hover:underline">
            Edit
          </summary>
          <form action={formAction} className="mt-3 rounded-lg border border-line bg-canvas p-3">
            <input type="hidden" name="id" value={activity.id} />
            {state.error && <div className="mb-3"><Notice tone="error">{state.error}</Notice></div>}
            {state.message && <div className="mb-3"><Notice tone="success">{state.message}</Notice></div>}
            <ActivityFields projectId={activity.projectId} activity={activity} />
            <div className="mt-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </details>
      </td>
      <td className="py-2 pr-3 text-ink-soft">{activity.unitType ?? '—'}</td>
      <td className="py-2 pr-3 text-ink-soft">{activity.intervention ?? '—'}</td>
      <td className="tabular py-2 pr-3 text-right">{fmtBDT(activity.unitRate)}</td>
      <td className="tabular py-2 pr-3 text-right">{fmtInt(activity.projectTarget)}</td>
      <td className="tabular py-2 pr-3 text-right">{fmtBDT(activity.projectBudget)}</td>
    </tr>
  );
}

export function MasterPanel({
  projects,
  activities,
}: {
  projects: AdminProject[];
  activities: AdminActivity[];
}) {
  const [projectState, projectAction, projectPending] = useActionState(
    createProjectAction, initialAdminState,
  );
  const [activityState, activityAction, activityPending] = useActionState(
    createActivityAction, initialAdminState,
  );

  const [filterProject, setFilterProject] = useState<number | ''>(projects[0]?.id ?? '');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const base = filterProject === '' ? activities : activities.filter((a) => a.projectId === filterProject);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (a) => a.name.toLowerCase().includes(q) || String(a.serialNumber) === q || a.activityCode.toLowerCase().includes(q),
    );
  }, [activities, filterProject, query]);

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle title="Projects" subtitle="Adding a project makes it selectable on the entry form." />
        {projectState.error && <div className="mb-3"><Notice tone="error">{projectState.error}</Notice></div>}
        {projectState.message && <div className="mb-3"><Notice tone="success">{projectState.message}</Notice></div>}

        <div className="mb-4 flex flex-wrap gap-2">
          {projects.map((p) => (
            <span
              key={p.id}
              className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[12.5px] text-ink"
            >
              <strong className="font-medium">{p.name}</strong>
              <span className="ml-2 font-mono text-[11.5px] text-ink-faint">{p.code}</span>
            </span>
          ))}
        </div>

        <form action={projectAction} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Project name">
            <Input name="name" required placeholder="e.g. SEEDS" />
          </Field>
          <Field label="Project code">
            <Input name="code" required placeholder="e.g. SEEDS-2024" className="font-mono" />
          </Field>
          <Button type="submit" disabled={projectPending}>
            {projectPending ? 'Adding…' : 'Add project'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle
          title="Activity master list"
          subtitle="The reference figures officers see when they pick an activity. Edits apply to future entries and, because the export joins these values live, to past entries too."
        />

        <details className="mb-5 rounded-lg border border-line bg-canvas p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700 hover:underline">
            Add a new activity
          </summary>
          <form action={activityAction} className="mt-3">
            {activityState.error && <div className="mb-3"><Notice tone="error">{activityState.error}</Notice></div>}
            {activityState.message && <div className="mb-3"><Notice tone="success">{activityState.message}</Notice></div>}
            <div className="mb-3">
              <Field label="Project">
                <Select name="projectId" required defaultValue={filterProject === '' ? '' : String(filterProject)}>
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <ActivityFields projectId={filterProject === '' ? (projects[0]?.id ?? 0) : filterProject} hideProjectInput />
            <div className="mt-3">
              <Button type="submit" size="sm" disabled={activityPending}>
                {activityPending ? 'Adding…' : 'Add activity'}
              </Button>
            </div>
          </form>
        </details>

        <div className="mb-3 grid items-end gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="Project">
            <Select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Filter by name, serial or code">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. training, or 42" />
          </Field>
        </div>

        <p className="mb-2 text-[12px] text-ink-soft">
          Showing {filtered.length} of {activities.length} activities.
        </p>

        <div className="max-h-[620px] overflow-auto scroll-thin rounded-lg border border-line">
          <table className="w-full min-w-[1000px] border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 font-medium">sl</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Activity</th>
                <th className="px-3 py-2 font-medium">Unit type</th>
                <th className="px-3 py-2 font-medium">Intervention</th>
                <th className="px-3 py-2 text-right font-medium">Unit rate</th>
                <th className="px-3 py-2 text-right font-medium">Target</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <ActivityRow key={a.id} activity={a} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-ink-soft">
                    No activities match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
