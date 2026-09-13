'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

export type NavItem = { href: string; label: string };

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scroll-thin">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors',
              active ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-canvas hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
