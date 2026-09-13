import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb, schema, getDbInfo } from '@/lib/db';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, homeFor } from '@/lib/roles';
import { LoginForm } from './login-form';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Demo helper. Off by default; set SHOW_DEMO_CODES=1 to render the current
 * access codes on the login screen. It exists because a reviewer demoing this
 * prototype has to be able to switch roles without digging through the
 * database — but leaving it on in a shared deployment would defeat the entire
 * point of handing out codes, so it is opt-in.
 */
async function DemoCodes() {
  if (process.env.SHOW_DEMO_CODES !== '1') return null;
  const db = await getDb();
  const codes = await db.select().from(schema.accessCodes);
  const byRole = new Map(codes.map((c) => [c.role, c.code]));
  return (
    <Card className="mt-5 border-dashed">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
        Demo helper — access codes
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
        Visible only because <code className="font-mono">SHOW_DEMO_CODES=1</code> is set.
      </p>
      <dl className="mt-3 space-y-1.5">
        {ROLES.map((r) => (
          <div key={r} className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <dt className="text-ink-soft">{ROLE_LABELS[r]}</dt>
            <dd className="font-mono font-medium text-ink">{byRole.get(r) ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  const info = getDbInfo();

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_minmax(380px,420px)] lg:gap-16">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-[15px] font-bold text-white">
            R
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">RDRS Monitoring MIS</p>
            <p className="text-[12px] text-ink-soft">Activity tracking &amp; reporting</p>
          </div>
        </div>

        <h1 className="mt-8 text-[30px] font-semibold leading-tight tracking-tight text-ink">
          Officers enter activity data directly.
          <br />
          <span className="text-brand-700">The consolidation step goes away.</span>
        </h1>

        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          Every branch currently tracks activities in its own format, and someone rebuilds the
          central workbook by hand each reporting period. Here, monitoring officers log in and
          submit straight into the database — and the data comes back out in the{' '}
          <strong className="font-medium text-ink">exact column format</strong> of the existing
          Tracking sheet, ready to hand over.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-line bg-surface p-3.5">
              <p className="text-[12.5px] font-semibold text-ink">{ROLE_LABELS[r]}</p>
              <p className="mt-1 text-[12px] leading-snug text-ink-soft">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[11.5px] text-ink-faint">
          Data store: <span className="font-mono">{info.driver}</span> — {info.target}
        </p>
      </div>

      <div>
        <Card>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mb-5 mt-1 text-[13px] leading-relaxed text-ink-soft">
            Your access code determines what you can see and do.
          </p>
          <LoginForm />
        </Card>
        <DemoCodes />
      </div>
    </main>
  );
}
