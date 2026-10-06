// src/components/settings/settings-nav.tsx
// The tabs across the settings pages, so it is always clear which part of the
// business is being changed.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

interface SettingsTab {
  key: string;
  label: string;
  href: string;
  description: string;
}

const TABS: SettingsTab[] = [
  {
    key: 'profile',
    label: 'Business profile',
    href: ROUTES.settings,
    description: 'Name, address and the details printed on documents.',
  },
  {
    key: 'invoicing',
    label: 'Documents',
    href: `${ROUTES.settings}/invoicing`,
    description: 'Numbering, wording and the look of your invoices.',
  },
  {
    key: 'payments',
    label: 'Getting paid',
    href: `${ROUTES.settings}/payments`,
    description: 'The providers your clients pay you through.',
  },
  {
    key: 'verification',
    label: 'Verification',
    href: `${ROUTES.settings}/verification`,
    description: 'The identity check that lets us settle card money to you.',
  },
  {
    key: 'accountants',
    label: 'Accountant',
    href: `${ROUTES.settings}/accountants`,
    description: 'Who outside the business may read your books.',
  },
  {
    key: 'webhooks',
    label: 'Event notifications',
    href: `${ROUTES.settings}/webhooks`,
    description: 'Have your own software told when something happens.',
  },
  {
    key: 'import',
    label: 'Bring records in',
    href: `${ROUTES.settings}/import`,
    description: 'Clients and products from the tool you used before.',
  },
  {
    key: 'integrations',
    label: 'Your connections',
    href: `${ROUTES.settings}/integrations`,
    description: 'Use your own accounts for the services you prefer.',
  },
  {
    key: 'storage',
    label: 'Document storage',
    href: `${ROUTES.settings}/storage`,
    description: 'The drive your receipts and contracts are kept in.',
  },
  {
    key: 'storefronts',
    label: 'Online shop',
    href: `${ROUTES.settings}/storefronts`,
    description: 'The shops whose orders are invoiced and collected here.',
  },
  {
    key: 'connected-apps',
    label: 'Connected applications',
    href: `${ROUTES.settings}/connected-apps`,
    description: 'The applications allowed to work with this account.',
  },
  {
    key: 'security',
    label: 'Security',
    href: `${ROUTES.settings}/security`,
    description: 'Sign in rules, client links and staff limits.',
  },
];

/**
 * Renders the settings tabs.
 *
 * @returns The rendered tabs.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.settings ? pathname === tab.href : pathname.startsWith(tab.href);

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
