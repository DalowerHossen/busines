// src/components/banking/banking-nav.tsx
// The two halves of the job: deciding what each line was, and looking after
// the connections the lines arrive through.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'review', label: 'To review', href: ROUTES.banking },
  { key: 'feeds', label: 'Bank connections', href: `${ROUTES.banking}/feeds` },
];

/**
 * Renders the banking tabs.
 *
 * @returns The rendered tabs.
 */
export function BankingNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Banking sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.banking ? pathname === tab.href : pathname.startsWith(tab.href);

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch items-center rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
