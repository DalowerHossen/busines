// src/components/instalments/instalment-plan-panel.tsx
// One arrangement: what was agreed, every payment in the schedule, and the
// two decisions an owner can still make about it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { cancelInstalmentPlan } from '@/features/instalments/actions/cancel-plan';
import { decideInstalmentPlan } from '@/features/instalments/actions/decide-plan';
import type { InstalmentPlanDetail } from '@/features/instalments/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface InstalmentPlanPanelProps {
  /** The arrangement being shown. */
  plan: InstalmentPlanDetail;
  /** True when the viewer may decide or end it. */
  canDecide: boolean;
}

/**
 * Picks the tone that matches the state of one payment.
 *
 * @param status State recorded on the payment.
 * @returns The tone of the badge.
 */
function itemTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'overdue' || status === 'failed') {
    return 'danger';
  }

  if (status === 'due' || status === 'partially_paid') {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Renders one arrangement.
 *
 * @param props The arrangement and what the viewer may do.
 * @returns The rendered arrangement.
 */
export function InstalmentPlanPanel({ plan, canDecide }: InstalmentPlanPanelProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const isPending = plan.status === 'pending';
  const canEnd = plan.status === 'pending' || plan.status === 'active';

  /**
   * Approves or refuses the arrangement.
   *
   * @param isApproved True when it is being approved.
   * @returns Nothing.
   */
  async function onDecide(isApproved: boolean): Promise<void> {
    if (!isApproved && reason.trim().length < 3) {
      setFailure('Say why the plan is being refused.');

      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await decideInstalmentPlan({
      planId: plan.planId,
      isApproved,
      reason: reason.trim() === '' ? undefined : reason.trim(),
    });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(isApproved ? 'That plan is approved.' : 'That plan has been refused.');
    router.refresh();
  }

  /**
   * Ends the arrangement early.
   *
   * @returns Nothing.
   */
  async function onCancel(): Promise<void> {
    if (reason.trim().length < 3) {
      setFailure('Say why the arrangement is ending.');

      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await cancelInstalmentPlan({ planId: plan.planId, reason: reason.trim() });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That arrangement has ended.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure === null ? null : (
        <Alert tone="danger" title="That did not go through">
          {failure}
        </Alert>
      )}

      {plan.declinedReason === null ? null : (
        <Alert tone="warning" title="This plan was refused">
          {plan.declinedReason}
        </Alert>
      )}

      {plan.cancellationReason === null ? null : (
        <Alert tone="warning" title="This arrangement was ended early">
          {plan.cancellationReason}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{plan.planReference}</CardTitle>
          <CardDescription>
            {plan.clientName ?? 'No client recorded'} ·{' '}
            {plan.invoiceNumber === null ? 'no invoice number' : `invoice ${plan.invoiceNumber}`} ·{' '}
            {humanise(plan.provider)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={plan.status === 'completed' ? 'success' : 'neutral'}>
              {humanise(plan.status)}
            </Badge>
            <Badge tone="neutral">
              {`${String(plan.paidCount)} of ${String(plan.instalmentCount)} paid`}
            </Badge>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Agreed in total</dt>
              <dd className="tabular text-sm font-medium">
                {formatMoney(plan.totalAmount, plan.currency)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Deposit</dt>
              <dd className="tabular text-sm font-medium">
                {formatMoney(plan.downPaymentAmount, plan.currency)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Still owed</dt>
              <dd className="tabular text-sm font-medium">
                {formatMoney(plan.outstandingAmount, plan.currency)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Last payment due</dt>
              <dd className="text-sm font-medium">{formatDate(plan.finalDueDate)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The schedule</CardTitle>
          <CardDescription>
            Each payment, what it is made of, and whether it has arrived.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead isNumeric>No.</TableHead>
                <TableHead>Due</TableHead>
                <TableHead isNumeric>Amount</TableHead>
                <TableHead isNumeric>Of which interest</TableHead>
                <TableHead isNumeric>Paid</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.schedule.map((item) => (
                <TableRow key={item.scheduleItemId}>
                  <TableCell isNumeric>{item.instalmentNumber}</TableCell>
                  <TableCell>{formatDate(item.dueDate)}</TableCell>
                  <TableCell isNumeric>{formatMoney(item.amount, plan.currency)}</TableCell>
                  <TableCell isNumeric>{formatMoney(item.interestAmount, plan.currency)}</TableCell>
                  <TableCell isNumeric>{formatMoney(item.paidAmount, plan.currency)}</TableCell>
                  <TableCell>
                    <Badge tone={itemTone(item.status)}>{humanise(item.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canDecide && (isPending || canEnd) ? (
        <Card>
          <CardHeader>
            <CardTitle>Decide</CardTitle>
            <CardDescription>
              A refusal or an early ending always carries a reason, so the client can be told why.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Reason</span>
              <Input
                value={reason}
                placeholder="Settled by bank transfer instead"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              {isPending ? (
                <>
                  <Button
                    type="button"
                    isLoading={isWorking}
                    loadingLabel="Working"
                    onClick={() => void onDecide(true)}
                  >
                    Approve the plan
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isWorking}
                    onClick={() => void onDecide(false)}
                  >
                    Refuse the plan
                  </Button>
                </>
              ) : null}

              {canEnd ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isWorking}
                  onClick={() => void onCancel()}
                >
                  End the arrangement
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
