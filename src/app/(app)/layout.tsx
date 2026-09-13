import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { can, ROLE_SHORT } from '@/lib/roles';
import { AppNav, type NavItem } from '@/components/app-nav';
import { logoutAction } from '@/app/login/actions';
import { Badge, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const items: NavItem[] = [];
  if (can.submit(session.role)) items.push({ href: '/entry', label: 'New entry' });
  if (can.viewAllEntries(session.role)) items.push({ href: '/records', label: 'Records' });
  if (can.editEntry(session.role)) items.push({ href: '/dashboard', label: 'Dashboard' });
  if (can.manageCodes(session.role) || can.manageMaster(session.role)) {
    items.push({ href: '/admin', label: 'Administration' });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-[13px] font-bold text-white">
              R
            </span>
            <span className="hidden text-[14px] font-semibold tracking-tight text-ink sm:block">
              RDRS Monitoring MIS
            </span>
          </Link>

          <AppNav items={items} />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight md:block">
              <p className="text-[12.5px] font-medium text-ink">{session.name}</p>
              <p className="text-[11.5px] text-ink-soft">
                {session.branch} · {session.designation}
              </p>
            </div>
            <Badge
              tone={
                session.role === 'SUPERADMIN' ? 'violet'
                : session.role === 'ADMIN' ? 'blue'
                : session.role === 'VIEW' ? 'neutral'
                : 'brand'
              }
            >
              {ROLE_SHORT[session.role]}
            </Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6">{children}</main>

      <footer className="no-print mx-auto max-w-[1500px] px-5 pb-8 pt-2">
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Prototype for internal demonstration. Not a production system — see the README for the
          assumptions and simplifications this build makes.
        </p>
      </footer>
    </div>
  );
}
