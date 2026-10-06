// src/components/marketing/pricing-table.tsx
// The plan cards, with the switch between paying monthly and paying for a
// year at a time.

'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/config/app';
import { PLAN_CURRENCY, type BillingPeriod, type Plan } from '@/config/plans';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PricingTableProps {
  /** Plans offered to the public, in the order they should appear. */
  plans: readonly Plan[];
}

/**
 * Works out the saving a yearly plan offers, as a whole percentage.
 *
 * @param plan Plan being shown.
 * @returns The saving, or null when there is nothing to save.
 */
function yearlySavingPercentage(plan: Plan): number | null {
  const monthly = Number.parseFloat(plan.monthlyPrice);
  const yearly = Number.parseFloat(plan.yearlyPrice);

  if (!Number.isFinite(monthly) || monthly <= 0 || !Number.isFinite(yearly)) {
    return null;
  }

  const saving = Math.round(((monthly - yearly) / monthly) * 100);

  return saving > 0 ? saving : null;
}

/**
 * Renders the plan cards and the billing period switch.
 *
 * @param props The plans to show.
 * @returns The rendered pricing table.
 */
export function PricingTable({ plans }: PricingTableProps) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  if (plans.length === 0) {
    return (
      <EmptyState
        title="Plans are being updated"
        description="Our plans are not on show at the moment. Write to us and we will tell you exactly what a plan costs for a business your size."
        action={
          <Link href={ROUTES.contact} className={buttonVariants({ variant: 'outline' })}>
            Contact us
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex rounded-full border border-border bg-surface p-1"
        >
          <button
            type="button"
            aria-pressed={period === 'monthly'}
            onClick={() => setPeriod('monthly')}
            className={cn(
              'min-h-touch rounded-full px-5 text-sm font-medium transition-colors duration-fast',
              period === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={period === 'yearly'}
            onClick={() => setPeriod('yearly')}
            className={cn(
              'min-h-touch rounded-full px-5 text-sm font-medium transition-colors duration-fast',
              period === 'yearly'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Yearly
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {period === 'yearly'
          ? 'Prices shown per month, billed once a year.'
          : 'Prices shown per month, billed monthly. Switch to yearly to pay less.'}
      </p>

      <ul className="grid gap-6 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = period === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          const isFree = Number.parseFloat(plan.monthlyPrice) === 0;
          const saving = yearlySavingPercentage(plan);

          return (
            <li
              key={plan.key}
              className={cn(
                'flex h-full flex-col rounded-xl border bg-surface p-6 shadow-xs',
                plan.badge ? 'border-brand-600 shadow-md ring-1 ring-brand-600' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                {plan.badge ? <Badge tone="brand">{plan.badge}</Badge> : null}
              </div>

              <p className="mt-2 min-h-[2.5rem] text-sm text-muted-foreground">{plan.tagline}</p>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="tabular text-3xl font-semibold text-foreground">
                  {formatMoney(price, PLAN_CURRENCY)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isFree ? 'always' : 'per month'}
                </span>
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {isFree
                  ? 'No card needed, now or later.'
                  : period === 'yearly' && saving !== null
                    ? `Billed yearly. Save ${saving}% against monthly.`
                    : `Includes a ${plan.trialDays} day free trial.`}
              </p>

              <Link
                href={`${ROUTES.register}?plan=${plan.key}`}
                className={cn(
                  buttonVariants({
                    variant: plan.badge ? 'primary' : 'outline',
                    fullWidth: true,
                  }),
                  'mt-5'
                )}
              >
                {plan.callToAction}
              </Link>

              <ul className="mt-6 space-y-2 border-t border-border pt-5">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm text-foreground">
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
