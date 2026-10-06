// src/components/ui/loading-state.tsx
// What a page or a panel shows while it waits. It reserves the same space the
// real content will take, so nothing jumps when the data arrives.

import { Skeleton, SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  /** Which arrangement of placeholders to draw. */
  variant?: 'page' | 'list' | 'card' | 'form';
  /** Text announced to a screen reader. */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the waiting state of a page or a panel.
 *
 * @param props Arrangement and accessible label.
 * @returns The rendered loading state.
 */
export function LoadingState({
  variant = 'page',
  label = 'Loading content',
  className,
}: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn('space-y-4', className)}>
      <span className="visually-hidden">{label}</span>

      {variant === 'page' ? (
        <>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_unused, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <SkeletonTable rows={5} columns={5} />
        </>
      ) : null}

      {variant === 'list' ? <SkeletonTable rows={6} columns={4} /> : null}

      {variant === 'card' ? (
        <div className="space-y-3 rounded-lg border border-border p-5">
          <Skeleton className="h-5 w-40" />
          <SkeletonText lines={3} />
        </div>
      ) : null}

      {variant === 'form' ? (
        <div className="max-w-form space-y-4">
          {Array.from({ length: 5 }, (_unused, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-32" />
        </div>
      ) : null}
    </div>
  );
}
