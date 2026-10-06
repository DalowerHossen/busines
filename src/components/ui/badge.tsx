// src/components/ui/badge.tsx
// A small label for a state or a count. Colour alone never carries the
// meaning: the word inside the badge always says it too.

import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        brand: 'border-transparent bg-brand-50 text-brand-700',
        success: 'border-transparent bg-success-subtle text-success',
        warning: 'border-transparent bg-warning-subtle text-warning',
        danger: 'border-transparent bg-destructive-subtle text-destructive',
        info: 'border-transparent bg-info-subtle text-info',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Renders a small state label.
 *
 * @param props Badge tone and content.
 * @returns The rendered badge.
 */
export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
