// src/components/admin/plan-catalogue.tsx
// The plans the platform sells: what each one costs, how many businesses are
// on it, and the controls to change any of that.

'use client';

import { useState } from 'react';

import { PlanEditor } from '@/components/admin/plan-editor';
import { PlanPriceEditor } from '@/components/admin/plan-price-editor';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { notify } from '@/components/ui/toaster';
import { setDefaultPlan } from '@/features/admin/actions/set-default-plan';
import type { AdminPlan } from '@/features/admin/queries/list-plans';
import { formatMoney, formatNumber, humanise } from '@/lib/format';
import { useRouter } from 'next/navigation';

export interface PlanCatalogueProps {
  /** Every plan, including the hidden and archived ones. */
  plans: readonly AdminPlan[];
}

/**
 * Renders the plan catalogue.
 *
 * @param props The plans to show.
 * @returns The rendered catalogue.
 */
export function PlanCatalogue({ plans }: PlanCatalogueProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pricing, setPricing] = useState<AdminPlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Makes one plan the plan new businesses start on.
   *
   * @param plan Plan being chosen.
   * @returns Nothing.
   */
  async function makeDefault(plan: AdminPlan): Promise<void> {
    setBusyId(plan.id);
    setFailure(null);

    const result = await setDefaultPlan({ planId: plan.id });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(`New businesses now start on ${plan.name}.`);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Plans</h2>
        <Button
          type="button"
          onClick={() => {
            setIsCreating(true);
          }}
        >
          New plan
        </Button>
      </div>

      {failure ? (
        <Alert tone="danger" title="That change was not saved">
          {failure}
        </Alert>
      ) : null}

      {plans.length === 0 ? (
        <EmptyState
          title="There is nothing to sell yet"
          description="Create the free plan first, mark it as the one new businesses start on, then add the paid plans above it."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                {plan.isDefaultOnSignup ? <Badge tone="success">Signup plan</Badge> : null}
                {plan.isArchived ? <Badge tone="warning">Archived</Badge> : null}
                {!plan.isPublic ? <Badge tone="neutral">Hidden</Badge> : null}
              </div>

              <p className="text-sm text-muted-foreground">{plan.tagline ?? 'No tagline yet.'}</p>

              <ul className="space-y-1 text-sm text-foreground">
                {plan.prices.length === 0 ? (
                  <li className="text-muted-foreground">No price set yet.</li>
                ) : (
                  plan.prices.map((price) => (
                    <li key={price.id} className="tabular">
                      {humanise(price.interval)}: {formatMoney(price.amount, price.currency)}
                    </li>
                  ))
                )}
              </ul>

              <p className="text-xs text-muted-foreground">
                {formatNumber(plan.subscriberCount)} businesses on this plan · collection fee{' '}
                {Number.parseFloat(plan.merchantFeePercentage).toFixed(2)}% plus{' '}
                {plan.merchantFeeFixed} a transaction
              </p>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(plan);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPricing(plan);
                  }}
                >
                  Set price
                </Button>
                {!plan.isDefaultOnSignup && !plan.isArchived ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    isLoading={busyId === plan.id}
                    loadingLabel="Saving"
                    onClick={() => {
                      void makeDefault(plan);
                    }}
                  >
                    Make signup plan
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {isCreating ? (
        <PlanEditor
          plan={null}
          isOpen
          onClose={() => {
            setIsCreating(false);
          }}
        />
      ) : null}

      {editing ? (
        <PlanEditor
          key={editing.id}
          plan={editing}
          isOpen
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}

      {pricing ? (
        <PlanPriceEditor
          key={`price-${pricing.id}`}
          plan={pricing}
          isOpen
          onClose={() => {
            setPricing(null);
          }}
        />
      ) : null}
    </section>
  );
}
