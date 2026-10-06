// src/components/loyalty/loyalty-nav.tsx
// The tabs across the loyalty pages, so it is always clear whether you are
// looking at the scheme, the members, or what clients said about you.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

interface LoyaltyTab {
  key: string;
  label: string;
  href: string;
}

const TABS: LoyaltyTab[] = [
  { key: 'members', label: 'Members', href: ROUTES.loyalty },
  { key: 'scheme', label: 'The scheme', href: `${ROUTES.loyalty}/scheme` },
  { key: 'reviews', label: 'Reviews', href: `${ROUTES.loyalty}/reviews` },
];

/**
 * Renders the loyalty tabs.
 *
 * @returns The rendered tabs.
 */
export function LoyaltyNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Loyalty sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.loyalty ? pathname === tab.href : pathname.startsWith(tab.href);

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-touch items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
