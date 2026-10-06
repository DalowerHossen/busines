// src/components/billing/plan-picker.tsx
// The plans a business can move to, with the price for the interval it
// chooses and what each plan unlocks.

'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { changePlan } from '@/features/billing/actions/change-plan';
import type { PlanOption } from '@/features/billing/types';
import { formatMoney, humanise } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BillingInterval } from '@/types/enums';

export interface PlanPickerProps {
  /** Plans on sale today. */
  plans: readonly PlanOption[];
  /** Plan the business is on, so it is marked rather than offered. */
  currentPlanId: string | null;
  /** Interval the business is billed on today. */
  currentInterval: BillingInterval;
  /** Currency the business is billed in. */
  currency: string;
  /** False when the signed in account may not change the plan. */
  canChange: boolean;
}

/** The intervals a visitor can switch between. */
const INTERVAL_CHOICES: readonly { value: BillingInterval; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Yearly' },
];

/**
 * Renders the plan catalogue.
 *
 * @param props The plans and what the viewer may do.
 * @returns The rendered picker.
 */
export function PlanPicker({
  plans,
  currentPlanId,
  currentInterval,
  currency,
  canChange,
}: PlanPickerProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>(
    currentInterval === 'annual' ? 'annual' : 'monthly'
  );
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Moves the business to another plan.
   *
   * @param plan Plan being chosen.
   * @returns Nothing.
   */
  async function choose(plan: PlanOption): Promise<void> {
    setBusyPlanId(plan.id);
    setFailure(null);

    const result = await changePlan({ planId: plan.id, interval });
    setBusyPlanId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(`You are now on ${plan.name}.`);
    router.refresh();
  }

  if (plans.length === 0) {
    return (
      <Alert tone="info" title="No plan is on sale at the moment">
        Your account keeps working on its current plan. Write to support if you were expecting to
        see an offer here.
      </Alert>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Change your plan</h2>

        <div
          className="inline-flex rounded-lg border border-border bg-surface-muted p-1"
          role="group"
          aria-label="Billing interval"
        >
          {INTERVAL_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={interval === choice.value}
              className={cn(
                'min-h-touch rounded-md px-4 text-sm font-medium transition-colors',
                interval === choice.value
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                setInterval(choice.value);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      {failure ? (
        <Alert tone="danger" title="That plan was not applied">
          {failure}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const price =
            plan.prices.find(
              (candidate) => candidate.interval === interval && candidate.currency === currency
            ) ?? plan.prices.find((candidate) => candidate.interval === interval);
          const isCurrent = plan.id === currentPlanId;
          const unlocked = Object.entries(plan.features).filter(([, isOn]) => isOn);

          return (
            <Card
              key={plan.id}
              className={cn(isCurrent ? 'border-brand-600 ring-1 ring-brand-600' : null)}
            >
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.badgeLabel ? <Badge tone="brand">{plan.badgeLabel}</Badge> : null}
                  {isCurrent ? <Badge tone="success">Your plan</Badge> : null}
                </div>
                <CardDescription>
                  {plan.tagline ?? 'Everything you need to invoice and get paid.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="tabular text-2xl font-semibold text-foreground">
                  {plan.isFree || price === undefined
                    ? 'Free'
                    : formatMoney(price.amount, price.currency)}
                  {!plan.isFree && price !== undefined ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {interval === 'annual' ? ' a year' : ' a month'}
                    </span>
                  ) : null}
                </p>

                {plan.trialDays > 0 && !isCurrent ? (
                  <p className="text-sm text-muted-foreground">
                    {plan.trialDays} day trial, no card needed to begin.
                  </p>
                ) : null}

                {unlocked.length > 0 ? (
                  <ul className="space-y-1.5">
                    {unlocked.map(([key]) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{humanise(key)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Collection fee when we take the payment for you:{' '}
                  {Number.parseFloat(plan.merchantFeePercentage).toFixed(2)}% plus{' '}
                  {formatMoney(plan.merchantFeeFixed, currency)} a transaction.
                </p>

                {canChange && !isCurrent ? (
                  <Button
                    type="button"
                    className="w-full"
                    isLoading={busyPlanId === plan.id}
                    loadingLabel="Switching"
                    onClick={() => {
                      void choose(plan);
                    }}
                  >
                    Switch to {plan.name}
                  </Button>
                ) : null}

                {isCurrent ? (
                  <p className="text-sm text-muted-foreground">
                    This is the plan you are on right now.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
