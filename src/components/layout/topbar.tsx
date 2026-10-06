// src/components/layout/topbar.tsx
// The bar across the top of the application: the menu button on a narrow
// screen, where you are, and the account menu.

import { CurrentPageTitle } from '@/components/layout/current-page-title';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { Badge } from '@/components/ui/badge';
import type { NavSection } from '@/config/navigation';
import { ROLE_DEFINITIONS } from '@/config/roles';
import type { CompanyContext, SessionUser } from '@/lib/auth/types';

export interface TopbarProps {
  /** Sections already filtered for the signed in account. */
  sections: readonly NavSection[];
  /** Signed in account. */
  user: SessionUser;
  /** Business being worked inside, when there is one. */
  company: CompanyContext | null;
  /** Name used when the open page is not one of the menu entries. */
  fallbackTitle?: string;
}

/**
 * Renders the top bar.
 *
 * @param props Navigation, account and current page.
 * @returns The rendered bar.
 */
export function Topbar({ sections, user, company, fallbackTitle = 'Overview' }: TopbarProps) {
  return (
    <header className="sticky top-0 z-sticky flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <MobileNav sections={sections} companyName={company?.displayName ?? null} />

      <div className="min-w-0 flex-1">
        <p className="flex text-sm font-semibold text-foreground">
          <CurrentPageTitle sections={sections} fallback={fallbackTitle} />
        </p>
        {company ? (
          <p className="truncate text-xs text-muted-foreground">{company.displayName}</p>
        ) : null}
      </div>

      {company?.isReadOnly ? <Badge tone="warning">Read only</Badge> : null}

      <UserMenu
        fullName={user.fullName}
        email={user.email}
        avatarUrl={user.avatarUrl}
        roleLabel={ROLE_DEFINITIONS[user.role].label}
        isTwoFactorEnabled={user.twoFactorEnabled}
      />
    </header>
  );
}
