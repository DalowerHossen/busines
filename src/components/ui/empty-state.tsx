// src/components/ui/empty-state.tsx
// What a list shows when there is nothing in it yet. It always explains what
// the thing is and offers the action that creates the first one.

import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Icon shown above the heading. */
  icon?: LucideIcon;
  /** Short heading, such as "No invoices yet". */
  title: string;
  /** One or two sentences explaining what to do next. */
  description: string;
  /** The action that creates the first record. */
  action?: ReactNode;
  /** A quieter secondary action, such as importing. */
  secondaryAction?: ReactNode;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the empty state of a list or a panel.
 *
 * @param props Heading, description and actions.
 * @returns The rendered empty state.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center',
        className
      )}
    >
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
