// src/components/dashboard/metric-card.tsx
// One figure on the dashboard, with what it means written underneath so the
// number is never left to speak for itself.

import { type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface MetricCardProps {
  /** Short name of the figure. */
  label: string;
  /** The figure itself, already formatted. */
  value: string;
  /** One line explaining what the figure counts. */
  description: string;
  /** Icon shown in the corner. */
  icon: LucideIcon;
  /** Draws attention when the figure needs action. */
  tone?: 'neutral' | 'warning' | 'success';
}

const TONES = {
  neutral: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-subtle text-warning',
  success: 'bg-success-subtle text-success',
} as const;

/**
 * Renders one figure.
 *
 * @param props Label, value, description and tone.
 * @returns The rendered card.
 */
export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>

      <p className="tabular text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
