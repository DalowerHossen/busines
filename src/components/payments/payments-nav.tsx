// src/components/payments/payments-nav.tsx
// The tabs across the money pages, so it is always clear whether you are
// looking at what came in, what went back, or what is being disputed.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

interface PaymentsTab {
  key: string;
  label: string;
  href: string;
}

const TABS: PaymentsTab[] = [
  { key: 'received', label: 'Received', href: ROUTES.payments },
  { key: 'refunds', label: 'Refunds', href: `${ROUTES.payments}/refunds` },
  { key: 'disputes', label: 'Disputes', href: `${ROUTES.payments}/disputes` },
  { key: 'instalments', label: 'Instalments', href: `${ROUTES.payments}/instalments` },
];

/**
 * Renders the money tabs.
 *
 * @returns The rendered tabs.
 */
export function PaymentsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Payment sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.payments ? pathname === tab.href : pathname.startsWith(tab.href);

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
