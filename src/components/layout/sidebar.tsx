// src/components/layout/sidebar.tsx
// The fixed navigation column on a wide screen: the brand at the top, the
// destinations in the middle and the plan of the business at the foot.

import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Logo } from '@/components/brand/logo';
import { ROUTES } from '@/config/app';
import type { NavSection } from '@/config/navigation';
import type { CompanyContext } from '@/lib/auth/types';

export interface SidebarProps {
  /** Sections already filtered for the signed in account. */
  sections: readonly NavSection[];
  /** The business being worked inside, when there is one. */
  company: CompanyContext | null;
  /** Name of the plan the business is on. */
  planName: string | null;
}

/**
 * Renders the sidebar for wide screens.
 *
 * @param props Navigation sections and the current business.
 * @returns The rendered sidebar.
 */
export function Sidebar({ sections, company, planName }: SidebarProps) {
  return (
    <aside className="hidden w-sidebar shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo href={ROUTES.dashboard} isInverted />
      </div>

      <SidebarNav sections={sections} />

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-sidebar-muted">Business</p>
        <p className="truncate text-sm font-medium text-sidebar-foreground">
          {company?.displayName ?? 'No business yet'}
        </p>
        {planName ? <p className="mt-1 text-xs text-sidebar-muted">{planName} plan</p> : null}
      </div>
    </aside>
  );
}
