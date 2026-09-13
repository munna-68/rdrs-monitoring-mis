'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ProjectRollup, ActivityRollup, MonthRollup, DemographicRollup, BranchRollup } from '@/lib/dashboard';

const AXIS = { fontSize: 11, fill: '#667085' } as const;
const GRID = '#eaecf0';

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

function TooltipBox({
  active,
  payload,
  label,
  moneyKeys = [],
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[];
  label?: string | number;
  moneyKeys?: string[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      {label !== undefined && (
        <p className="mb-1 max-w-[260px] text-[12px] font-medium leading-snug text-ink">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="tabular text-[12px] text-ink-soft">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}:{' '}
          <span className="font-medium text-ink">
            {typeof p.value === 'number'
              ? moneyKeys.includes(String(p.dataKey))
                ? `৳${p.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : p.value.toLocaleString('en-US')
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* -------------------- achievement vs target, by project -------------------- */

export function AchievementByProject({ data }: { data: ProjectRollup[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="project" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#475467' }} />
        <Bar dataKey="achievement" name="Recorded achievement" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="target" name="Project target" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------- top activities vs their target ----------------------- */

export function AchievementByActivity({ data }: { data: ActivityRollup[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS, fontSize: 10.5 }}
          width={230}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#475467' }} />
        <Bar dataKey="target" name="Target" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
        <Bar dataKey="achievement" name="Recorded" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------- expenditure over time --------------------------- */

export function ExpenditureTrend({ data }: { data: MonthRollup[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          yAxisId="money"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `৳${compact(v)}`}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={compact}
        />
        <Tooltip
          content={<TooltipBox moneyKeys={['expenditure']} />}
          cursor={{ fill: 'rgba(13,148,136,0.06)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#475467' }} />
        <Bar
          yAxisId="count"
          dataKey="entries"
          name="Entries"
          fill="#e2e8f0"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
        />
        <Line
          yAxisId="money"
          type="monotone"
          dataKey="expenditure"
          name="Expenditure (BDT)"
          stroke="var(--chart-3)"
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------- beneficiary demographics ------------------------- */

export function DemographicBreakdown({ data }: { data: DemographicRollup[] }) {
  const palette = [
    'var(--chart-5)', 'var(--chart-2)', 'var(--chart-4)',
    'var(--chart-7)', 'var(--chart-6)', 'var(--chart-9)',
    'var(--chart-8)', 'var(--chart-1)', 'var(--chart-3)',
  ];
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS, fontSize: 11 }}
          width={140}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
        <Bar dataKey="value" name="Beneficiaries" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={d.key} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------- branch-wise counts ---------------------------- */

export function BranchCounts({ data }: { data: BranchRollup[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="branch" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#475467' }} />
        <Bar dataKey="entries" name="Entries" fill="var(--chart-6)" radius={[4, 4, 0, 0]} maxBarSize={54} />
        <Bar dataKey="beneficiaries" name="Beneficiaries" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={54} />
      </BarChart>
    </ResponsiveContainer>
  );
}
