// src/components/ui/spinner.tsx
// A small spinner for inline waiting states.

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export interface SpinnerProps {
  /** Size of the spinner. */
  size?: keyof typeof SIZES;
  /** Text announced to a screen reader. */
  label?: string;
  /** Extra classes for the icon. */
  className?: string;
}

/**
 * Renders a spinning indicator with an accessible label.
 *
 * @param props Size and label.
 * @returns The rendered spinner.
 */
export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2
        aria-hidden="true"
        className={cn('animate-spin text-muted-foreground', SIZES[size], className)}
      />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
