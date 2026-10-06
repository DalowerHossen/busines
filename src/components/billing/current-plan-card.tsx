// src/components/billing/current-plan-card.tsx
// The plan a business is on today, what it costs, when it renews, and the
// two decisions an owner can take about it: stop it, or start it again.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CouponForm } from '@/components/billing/coupon-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { cancelPlan } from '@/features/billing/actions/cancel-plan';
import { resumePlan } from '@/features/billing/actions/resume-plan';
import type { CurrentPlan } from '@/features/billing/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface CurrentPlanCardProps {
  /** The live subscription of this business. */
  current: CurrentPlan;
  /** False when the signed in account may not change the plan. */
  canManage: boolean;
}

/**
 * Renders the summary of the live plan.
 *
 * @param props The plan and what the viewer may do with it.
 * @returns The rendered card.
 */
export function CurrentPlanCard({ current, canManage }: CurrentPlanCardProps) {
  const router = useRouter();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reasonErrors, setReasonErrors] = useState<readonly string[]>([]);

  const intervalLabel =
    current.interval === 'monthly'
      ? 'a month'
      : current.interval === 'annual'
        ? 'a year'
        : 'one payment';

  /**
   * Stops the plan at the end of the paid period.
   *
   * @returns Nothing.
   */
  async function confirmCancel(): Promise<void> {
    setIsWorking(true);
    setFailure(null);
    setReasonErrors([]);

    const result = await cancelPlan({ isImmediate: false, reason });
    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);
      setReasonErrors(result.fieldErrors?.reason ?? []);
      return;
    }

    setIsCancelOpen(false);
    setReason('');
    notify.success('Your plan will stop when the paid period ends.');
    router.refresh();
  }

  /**
   * Puts the plan back into service.
   *
   * @returns Nothing.
   */
  async function confirmResume(): Promise<void> {
    setIsWorking(true);
    setFailure(null);

    const result = await resumePlan({});
    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Your plan is running again.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {current.cancelAtPeriodEnd || current.status === 'paused' ? (
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={isWorking}
                  loadingLabel="Restarting"
                  onClick={() => {
                    void confirmResume();
                  }}
                >
                  Keep my plan
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCancelOpen(true);
                  }}
                >
                  Stop this plan
                </Button>
              )}
            </div>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{current.planName}</CardTitle>
          <StatusBadge kind="subscription" status={current.status} />
        </div>
        <CardDescription>
          {Number.parseFloat(current.amount) === 0
            ? 'You are on the free plan. Nothing is charged for it, ever.'
            : `${formatMoney(current.amount, current.currency)} ${intervalLabel}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That change was not saved">
            {failure}
          </Alert>
        ) : null}

        {current.status === 'past_due' ? (
          <Alert tone="warning" title="A payment to us did not go through">
            Settle the open platform invoice below to keep everything switched on.
            {current.gracePeriodEndsOn
              ? ` Access pauses on ${formatDate(current.gracePeriodEndsOn)}.`
              : ''}
          </Alert>
        ) : null}

        {current.status === 'paused' ? (
          <Alert tone="warning" title="Your plan is paused">
            Your records are safe and nothing has been deleted. Settle the open platform invoice and
            press Keep my plan to switch everything back on.
          </Alert>
        ) : null}

        {current.cancelAtPeriodEnd ? (
          <Alert tone="info" title="Your plan is set to stop">
            It keeps working until {formatDate(current.currentPeriodEnd)}, then your account falls
            back to the free plan. Nothing is deleted.
          </Alert>
        ) : null}

        {current.status === 'trialing' && current.trialEndDate ? (
          <Alert tone="info" title="You are on a trial">
            The trial runs until {formatDate(current.trialEndDate)}. No card is charged before that.
          </Alert>
        ) : null}

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Billed</dt>
            <dd className="font-medium text-foreground">{humanise(current.interval)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">This period</dt>
            <dd className="font-medium text-foreground">
              {formatDate(current.currentPeriodStart)} to {formatDate(current.currentPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Next charge</dt>
            <dd className="font-medium text-foreground">
              {current.nextBillingDate ? formatDate(current.nextBillingDate) : 'Nothing scheduled'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Discount applied</dt>
            <dd className="tabular font-medium text-foreground">
              {formatMoney(current.discountAmount, current.currency)}
            </dd>
          </div>
        </dl>

        <CouponForm canRedeem={canManage} />
      </CardContent>

      <Modal
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
        }}
        title="Stop this plan"
        description="Your plan keeps working until the end of the period you have already paid for, then your account moves to the free plan. Your invoices, clients and records stay exactly where they are."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCancelOpen(false);
              }}
            >
              Keep my plan
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Stopping"
              onClick={() => {
                void confirmCancel();
              }}
            >
              Stop at period end
            </Button>
          </div>
        }
      >
        <FormField
          id="cancel-reason"
          label="Why are you leaving?"
          hint="This goes to the product team, not to a sales script."
          errors={reasonErrors}
          isRequired
        >
          <Textarea
            {...fieldAccessibilityProps('cancel-reason', true, reasonErrors.length > 0)}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </FormField>
      </Modal>
    </Card>
  );
}
