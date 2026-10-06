// src/components/billing/usage-meters.tsx
// How much of each plan allowance a business has used this period, shown as
// a bar so the answer is readable before the number is.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { UsageMeter } from '@/features/billing/types';
import { humanise } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface UsageMetersProps {
  /** The meters read for this business. */
  meters: readonly UsageMeter[];
}

/**
 * Returns how full one meter is, as a percentage between 0 and 100.
 *
 * @param meter Meter being drawn.
 * @returns The fill percentage.
 */
function fillPercentage(meter: UsageMeter): number {
  if (meter.allowance === null || meter.allowance <= 0) {
    return 0;
  }

  return Math.min(Math.round((meter.used / meter.allowance) * 100), 100);
}

/**
 * Returns the colour the bar is drawn in.
 *
 * @param percentage How full the meter is.
 * @returns The Tailwind class for the fill.
 */
function fillTone(percentage: number): string {
  if (percentage >= 100) {
    return 'bg-destructive';
  }

  if (percentage >= 80) {
    return 'bg-warning';
  }

  return 'bg-brand-600';
}

/**
 * Renders the allowance meters.
 *
 * @param props The meters to draw.
 * @returns The rendered card.
 */
export function UsageMeters({ meters }: UsageMetersProps) {
  const metered = meters.filter((meter) => meter.allowance !== null || meter.used > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What you have used</CardTitle>
        <CardDescription>
          Monthly allowances start again at the beginning of each month. An allowance your plan does
          not cap is shown as unlimited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metered.length === 0 ? (
          <EmptyState
            title="Nothing has been metered yet"
            description="As soon as you send an invoice or add a colleague, the figures appear here."
          />
        ) : (
          <ul className="space-y-4">
            {metered.map((meter) => {
              const percentage = fillPercentage(meter);
              const isUnlimited = meter.allowance === null;

              return (
                <li key={`${meter.metricKey}-${meter.periodKey}`} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {humanise(meter.metricKey)}
                    </span>
                    <span className="tabular text-sm text-muted-foreground">
                      {isUnlimited
                        ? `${meter.used} used, unlimited on this plan`
                        : `${meter.used} of ${meter.allowance} used`}
                    </span>
                  </div>

                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${humanise(meter.metricKey)} used`}
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', fillTone(percentage))}
                      style={{ width: `${isUnlimited ? 6 : percentage}%` }}
                    />
                  </div>

                  {!isUnlimited && meter.remaining !== null ? (
                    <p className="text-xs text-muted-foreground">
                      {meter.remaining === 0
                        ? 'You have reached the limit of this plan. Move up a plan to carry on.'
                        : `${meter.remaining} left this period.`}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
