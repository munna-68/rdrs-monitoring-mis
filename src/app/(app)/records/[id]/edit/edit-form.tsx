'use client';

import { useActionState, useMemo, useState } from 'react';
import { updateEntryAction, initialEditState } from '../actions';
import { BENEFICIARY_COLUMNS, type BeneficiaryKey } from '@/lib/tracking-headers';
import { Button, Card, CardTitle, Field, Input, Notice, fmtInt } from '@/components/ui';

type Counts = Record<BeneficiaryKey, number>;

const GROUPS: { title: string; keys: BeneficiaryKey[] }[] = [
  { title: 'Adults (26+)', keys: ['female26', 'male26', 'pwd26'] },
  { title: 'Youth (15–25)', keys: ['youthFemale', 'youthMale', 'youthPwd'] },
  { title: 'Children (0–14)', keys: ['girl', 'boy', 'pwd14'] },
];

const labelFor = (key: BeneficiaryKey) =>
  BENEFICIARY_COLUMNS.find((c) => c.key === key)?.label ?? key;

export function EditForm({
  id,
  entryDate,
  actualExpenditure,
  counts: initialCounts,
  readOnlyContext,
}: {
  id: number;
  entryDate: string;
  actualExpenditure: number;
  counts: Counts;
  readOnlyContext: { label: string; value: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(updateEntryAction, initialEditState);

  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [date, setDate] = useState(entryDate);
  const [expenditure, setExpenditure] = useState(String(actualExpenditure ?? 0));

  const total = useMemo(
    () => BENEFICIARY_COLUMNS.reduce((sum, c) => sum + (Number(counts[c.key]) || 0), 0),
    [counts],
  );

  const setCount = (key: BeneficiaryKey, raw: string) => {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    setCounts((prev) => ({ ...prev, [key]: n }));
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={id} />

      {state.error && <Notice tone="error">{state.error}</Notice>}

      <Card>
        <CardTitle
          title="Entry being corrected"
          subtitle="Reference values come from the activity master list and cannot be edited here — they change for every entry at once if the master is updated."
        />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          {readOnlyContext.map((r) => (
            <div key={r.label}>
              <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{r.label}</dt>
              <dd className="text-[13px] leading-snug text-ink">{r.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardTitle title="Corrected values" />

        <div className="grid gap-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <Field label="Date of activity">
              <Input
                name="entryDate"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Actual expenditure (BDT)">
              <Input
                name="actualExpenditure"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={expenditure}
                onChange={(e) => setExpenditure(e.target.value)}
                className="tabular"
              />
            </Field>
          </div>

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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
            Total beneficiaries
          </p>
          <p className="tabular text-[28px] font-semibold leading-none text-brand-900">{fmtInt(total)}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving correction…' : 'Save correction'}
          </Button>
          <p className="text-[12px] text-ink-soft">
            Your name and the current time are recorded against this correction.
          </p>
        </div>
      </Card>
    </form>
  );
}
