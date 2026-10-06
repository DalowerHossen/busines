import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionHref?: string;
  readonly icon?: ReactNode;
  readonly className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/50 px-6 py-10 text-center',
        className
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </span>
      <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <a
          href={actionHref}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          {actionLabel}
        </a>
      ) : actionLabel && onAction ? (
        <Button type="button" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
