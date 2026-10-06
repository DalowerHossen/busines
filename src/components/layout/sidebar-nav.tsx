// src/components/layout/sidebar-nav.tsx
// The list of destinations inside the sidebar. It marks the current page for
// a screen reader as well as visually.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavIcon } from '@/components/layout/nav-icon';
import type { NavSection } from '@/config/navigation';
import { cn } from '@/lib/utils';

export interface SidebarNavProps {
  /** Sections already filtered for the signed in account. */
  sections: readonly NavSection[];
  /** Called after a link is followed, so a mobile drawer can close itself. */
  onNavigate?: () => void;
}

/**
 * Renders the navigation list.
 *
 * @param props Sections to render and the close callback.
 * @returns The rendered navigation.
 */
export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.key} className="space-y-1">
          {section.label ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
              {section.label}
            </p>
          ) : null}

          <ul className="space-y-1">
            {section.items.map((item) => {
              const isActive = item.isExact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onNavigate}
                    className={cn(
                      'flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-fast',
                      isActive
                        ? 'bg-sidebar-active text-sidebar-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground'
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
