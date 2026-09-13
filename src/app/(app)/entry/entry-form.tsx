'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createEntryAction } from './actions';
import { initialEntryState } from '@/lib/action-state';
import { BENEFICIARY_COLUMNS, type BeneficiaryKey } from '@/lib/tracking-headers';
import { Button, Card, CardTitle, Field, Input, Notice, Select, fmtBDT, fmtInt } from '@/components/ui';

export type ProjectOption = { id: number; name: string; code: string };

export type ActivityOption = {
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

type Counts = Record<BeneficiaryKey, number>;

const zeroCounts = (): Counts => ({
  female26: 0, male26: 0, pwd26: 0,
  youthFemale: 0, youthMale: 0, youthPwd: 0,
  girl: 0, boy: 0, pwd14: 0,
});

const GROUPS: { title: string; keys: BeneficiaryKey[] }[] = [
  { title: 'Adults (26+)', keys: ['female26', 'male26', 'pwd26'] },
  { title: 'Youth (15–25)', keys: ['youthFemale', 'youthMale', 'youthPwd'] },
  { title: 'Children (0–14)', keys: ['girl', 'boy', 'pwd14'] },
];

const labelFor = (key: BeneficiaryKey) =>
  BENEFICIARY_COLUMNS.find((c) => c.key === key)?.label ?? key;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EntryForm({
  projects,
  activities,
}: {
  projects: ProjectOption[];
  activities: ActivityOption[];
}) {
  const [state, formAction, pending] = useActionState(createEntryAction, initialEntryState);

  const [projectId, setProjectId] = useState<number | ''>('');
  const [activityId, setActivityId] = useState<number | ''>('');
  const [query, setQuery] = useState('');
  const [entryDate, setEntryDate] = useState(todayISO);
  const [expenditure, setExpenditure] = useState('');
  const [counts, setCounts] = useState<Counts>(zeroCounts);
  const formRef = useRef<HTMLFormElement>(null);

  const projectActivities = useMemo(
    () => (projectId === '' ? [] : activities.filter((a) => a.projectId === projectId)),
    [activities, projectId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projectActivities;
    return projectActivities.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        String(a.serialNumber) === q ||
        a.activityCode.toLowerCase().includes(q),
    );
  }, [projectActivities, query]);

  const selected = useMemo(
    () => activities.find((a) => a.id === activityId) ?? null,
    [activities, activityId],
  );

  const total = useMemo(
    () => BENEFICIARY_COLUMNS.reduce((sum, c) => sum + (Number(counts[c.key]) || 0), 0),
    [counts],
  );

  // Clear the form after a successful save. Keyed on the message so a second
  // successful submit with the same text still resets.
  useEffect(() => {
    if (!state.ok) return;
    setActivityId('');
    setQuery('');
    setExpenditure('');
    setCounts(zeroCounts());
    setEntryDate(todayISO());
  }, [state.ok, state.message]);

  const setCount = (key: BeneficiaryKey, raw: string) => {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    setCounts((prev) => ({ ...prev, [key]: n }));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}

      <Card>
        <CardTitle
          title="Activity entry"
          subtitle="Pick the project and activity first — the master figures are then pulled in as reference so nothing has to be retyped."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project">
            <Select
              name="projectId"
              required
              value={projectId}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setProjectId(v);
                setActivityId('');
                setQuery('');
              }}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date of activity">
            <Input
              name="entryDate"
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <Field
              label="Find activity"
              hint={
                projectId === ''
                  ? 'Choose a project first.'
                  : `${projectActivities.length} activities in this project. Filter by name or serial number.`
              }
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={projectId === ''}
                placeholder="e.g. teacher, or 12"
              />
            </Field>

            <Field label="Activity">
              <Select
                name="activityId"
                required
                value={activityId}
                disabled={projectId === ''}
                onChange={(e) => setActivityId(e.target.value === '' ? '' : Number(e.target.value))}
                size={8}
                className="h-auto"
              >
                <option value="">Select an activity…</option>
                {filtered.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.serialNumber}. {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            {projectId !== '' && filtered.length === 0 && (
              <p className="text-[12px] text-ink-soft">No activity matches “{query}”.</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
              Reference from master list
            </p>
            {selected ? (
              <>
                <p className="mt-2 text-[13.5px] font-medium leading-snug text-ink">{selected.name}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    ['Activity code', selected.activityCode],
                    ['Serial no.', String(selected.serialNumber)],
                    ['Unit type', selected.unitType],
                    ['Intervention', selected.intervention],
                    ['Activity type', selected.activityType],
                    ['Unit rate (BDT)', selected.unitRate === null ? null : fmtBDT(selected.unitRate)],
                    ['Project target', selected.projectTarget === null ? null : fmtInt(selected.projectTarget)],
                    ['Project budget (BDT)', selected.projectBudget === null ? null : fmtBDT(selected.projectBudget)],
                    ['Annual target', selected.annualTarget === null ? null : fmtInt(selected.annualTarget)],
                    ['Annual budget (BDT)', selected.annualBudget === null ? null : fmtBDT(selected.annualBudget)],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{k}</dt>
                      <dd className="tabular text-[13px] text-ink">
                        {v === null || v === undefined || v === '' ? '—' : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Select an activity and its unit type, intervention, unit rate and targets will appear
                here, read-only. These are never re-entered — they are joined from the master list
                when the report is generated.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          title="Actuals for this entry"
          subtitle="Expenditure in BDT, plus the beneficiary breakdown. The total is calculated as you type."
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
          <Field label="Actual expenditure (BDT)">
            <Input
              name="actualExpenditure"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={expenditure}
              onChange={(e) => setExpenditure(e.target.value)}
              placeholder="0"
              className="tabular text-[15px]"
            />
          </Field>

          <div className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {group.title}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {group.keys.map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-[12px] text-ink-soft">{labelFor(key)}</span>
                      <Input
                        name={key}
                        type="number"
                        min={0}
                        step="1"
                        inputMode="numeric"
                        value={counts[key] === 0 ? '' : String(counts[key])}
                        onChange={(e) => setCount(key, e.target.value)}
                        placeholder="0"
                        className="tabular"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
              Total beneficiaries
            </p>
            <p className="text-[11.5px] text-brand-800/80">
              Sum of the nine breakdown columns — computed, not entered.
            </p>
          </div>
          <p className="tabular text-[28px] font-semibold leading-none text-brand-900">{fmtInt(total)}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={pending || projectId === '' || activityId === ''}>
            {pending ? 'Saving…' : 'Submit entry'}
          </Button>
          <p className="text-[12px] text-ink-soft">
            Entries cannot be edited after submitting. Ask an Admin to correct a mistake.
          </p>
        </div>
      </Card>
    </form>
  );
}
