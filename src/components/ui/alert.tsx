// src/components/ui/alert.tsx
// A message block at the top of a page or a form. Errors are announced to a
// screen reader as soon as they appear.

import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-3 rounded-md border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info-subtle text-foreground',
      success: 'border-success/30 bg-success-subtle text-foreground',
      warning: 'border-warning/30 bg-warning-subtle text-foreground',
      danger: 'border-destructive/30 bg-destructive-subtle text-foreground',
    },
  },
  defaultVariants: {
    tone: 'info',
  },
});

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

const ICON_TONES = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
} as const;

export interface AlertProps extends VariantProps<typeof alertVariants> {
  /** Short heading. */
  title: string;
  /** Explanation under the heading. */
  children?: ReactNode;
  /** Action shown on the right, such as a retry button. */
  action?: ReactNode;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders a message block.
 *
 * @param props Tone, heading and body.
 * @returns The rendered alert.
 */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const safeTone = tone ?? 'info';
  const Icon = ICONS[safeTone];

  return (
    <div
      role={safeTone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone: safeTone }), className)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONES[safeTone])} />
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
