// src/components/ui/skeleton.tsx
// The grey shapes shown while real content is still loading.

import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Renders one placeholder shape.
 *
 * @param props Standard division attributes.
 * @returns The rendered placeholder.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('shimmer rounded-md', className)} {...props} />;
}

export interface SkeletonTextProps {
  /** How many lines to draw. */
  lines?: number;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a few grey lines while text loads.
 *
 * @param props How many lines to draw.
 * @returns The rendered placeholder.
 */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_unused, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export interface SkeletonTableProps {
  /** How many rows to draw. */
  rows?: number;
  /** How many columns to draw. */
  columns?: number;
}

/**
 * Renders a placeholder table while a list is loading.
 *
 * @param props How many rows and columns to draw.
 * @returns The rendered placeholder.
 */
export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }, (_unused, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }, (_column, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
