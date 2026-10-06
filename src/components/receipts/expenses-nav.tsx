// src/components/receipts/expenses-nav.tsx
// The two ways a cost gets recorded: typed in by hand, or photographed and
// read for you.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'expenses', label: 'Expenses', href: ROUTES.expenses },
  { key: 'receipts', label: 'Receipts', href: `${ROUTES.expenses}/receipts` },
];

/**
 * Renders the expenses tabs.
 *
 * @returns The rendered tabs.
 */
export function ExpensesNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Expense sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.expenses ? pathname === tab.href : pathname.startsWith(tab.href);

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
