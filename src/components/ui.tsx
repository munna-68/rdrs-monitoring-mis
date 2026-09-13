import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------- layout ------------------------------- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/* ------------------------------ controls ------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors ' +
    'disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
  const sizes = { sm: 'px-2.5 py-1.5 text-[12.5px]', md: 'px-3.5 py-2 text-[13.5px]' };
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
    ghost: 'text-ink-soft hover:bg-canvas hover:text-ink',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...rest} />;
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink',
        'placeholder:text-ink-faint disabled:bg-canvas disabled:text-ink-soft',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink',
        'disabled:bg-canvas disabled:text-ink-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-ink-faint">{hint}</span>}
    </label>
  );
}

/* ------------------------------ feedback ------------------------------ */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'amber' | 'blue' | 'violet' | 'red';
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
    brand: 'bg-brand-50 text-brand-800 ring-brand-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        {accent && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      </div>
      <p className="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-ink-soft">{sub}</p>}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-soft">{body}</p>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
  };
  return (
    <div className={cx('rounded-lg border px-3 py-2 text-[13px] leading-relaxed', tones[tone])}>{children}</div>
  );
}

/* ------------------------------ formatting ------------------------------ */

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

export function fmtBDT(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
