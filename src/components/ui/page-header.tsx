// src/components/ui/page-header.tsx
// The band at the top of every page: where you are, what the page is for and
// the actions that belong to it.

import { type ReactNode } from 'react';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { cn } from '@/lib/utils';
import type { Breadcrumb } from '@/types/common';

export interface PageHeaderProps {
  /** Page title. */
  title: string;
  /** One sentence explaining what the page is for. */
  description?: string;
  /** The trail above the title. */
  breadcrumbs?: readonly Breadcrumb[];
  /** Buttons for this page, such as "New invoice". */
  actions?: ReactNode;
  /** Status badge or similar, shown beside the title. */
  badge?: ReactNode;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the header of a page.
 *
 * @param props Title, description, trail and actions.
 * @returns The rendered header.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
            {badge}
          </div>
          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
