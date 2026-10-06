// src/components/messaging/messaging-nav.tsx
// The tabs across the messaging pages, so it is always clear whether you are
// looking at what went out, how it goes out, or what came back.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/config/app';
import { cn } from '@/lib/utils';

interface MessagingTab {
  key: string;
  label: string;
  href: string;
}

const TABS: readonly MessagingTab[] = [
  { key: 'outbox', label: 'Outbox', href: ROUTES.messages },
  { key: 'channels', label: 'Channels', href: `${ROUTES.messages}/channels` },
  { key: 'routes', label: 'Fallback chains', href: `${ROUTES.messages}/routes` },
  { key: 'replies', label: 'Replies', href: `${ROUTES.messages}/replies` },
];

/**
 * Renders the messaging tabs.
 *
 * @returns The rendered tabs.
 */
export function MessagingNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Messaging sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive =
            tab.href === ROUTES.messages ? pathname === tab.href : pathname.startsWith(tab.href);

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
