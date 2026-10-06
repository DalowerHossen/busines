// src/components/ui/separator.tsx
// A dividing line between sections, optionally with a word in the middle.

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SeparatorProps {
  /** Text shown in the middle of the line. */
  label?: ReactNode;
  /** Direction of the line. */
  orientation?: 'horizontal' | 'vertical';
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a dividing line.
 *
 * @param props Orientation and optional label.
 * @returns The rendered separator.
 */
export function Separator({ label, orientation = 'horizontal', className }: SeparatorProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch bg-border', className)}
      />
    );
  }

  if (!label) {
    return <div role="separator" className={cn('h-px w-full bg-border', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
