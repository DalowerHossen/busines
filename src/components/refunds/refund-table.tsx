// src/components/refunds/refund-table.tsx
// The money this business has given back, and the refunds still waiting for
// the owner to decide.

'use client';

import { Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { reviewRefund } from '@/features/refunds/actions/review-refund';
import type { RefundSummary } from '@/features/refunds/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface RefundTableProps {
  /** The refunds to show. */
  refunds: readonly RefundSummary[];
  /** False when the signed in account may not approve a refund. */
  canReview: boolean;
}

/**
 * Renders the refund list with its approval actions.
 *
 * @param props The refunds and what the viewer may do.
 * @returns The rendered list.
 */
export function RefundTable({ refunds, canReview }: RefundTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [declining, setDeclining] = useState<RefundSummary | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  /**
   * Records a decision on one refund.
   *
   * @param refund Refund being decided.
   * @param approve True to release the money, false to decline it.
   * @param reason Why it was declined.
   * @returns Nothing.
   */
  async function decide(
    refund: RefundSummary,
    approve: boolean,
    reason: string | null
  ): Promise<void> {
    setBusyId(refund.id);
    setFailure(null);

    const result = await reviewRefund({
      refundId: refund.id,
      approve,
      reason: reason ?? undefined,
    });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(
      result.data.decision === 'approved' ? 'Refund approved and paid back.' : 'Refund declined.'
    );
    setDeclining(null);
    setDeclineReason('');
    router.refresh();
  }

  if (refunds.length === 0) {
    return (
      <EmptyState
        title="No money has been given back"
        description="Refunds you record against a payment appear here, together with any that are waiting for your approval."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That decision was not saved">
          {failure}
        </Alert>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead isNumeric>Amount</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((refund) => (
              <TableRow key={refund.id}>
                <TableCell>{formatDateTime(refund.requestedAt)}</TableCell>
                <TableCell>{refund.clientName}</TableCell>
                <TableCell>
                  <span className="block max-w-xs truncate">{refund.reason}</span>
                  {refund.rejectionReason ? (
                    <span className="block text-sm text-muted-foreground">
                      Declined: {refund.rejectionReason}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell isNumeric>{formatMoney(refund.amount, refund.currency)}</TableCell>
                <TableCell>
                  <StatusBadge kind="refund" status={refund.status} />
                </TableCell>
                <TableCell>
                  {canReview && refund.approvalStatus === 'pending' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        isLoading={busyId === refund.id}
                        loadingLabel="Saving"
                        onClick={() => {
                          void decide(refund, true, null);
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === refund.id}
                        onClick={() => {
                          setDeclining(refund);
                          setDeclineReason('');
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {refunds.map((refund) => (
          <li key={refund.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{refund.clientName}</p>
                <p className="text-sm text-muted-foreground">{refund.reason}</p>
              </div>
              <StatusBadge kind="refund" status={refund.status} />
            </div>

            <p className="tabular mt-2 font-medium text-foreground">
              {formatMoney(refund.amount, refund.currency)}
            </p>
            <p className="text-sm text-muted-foreground">{formatDateTime(refund.requestedAt)}</p>

            {canReview && refund.approvalStatus === 'pending' ? (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  isLoading={busyId === refund.id}
                  loadingLabel="Saving"
                  leadingIcon={<Undo2 aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => {
                    void decide(refund, true, null);
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === refund.id}
                  onClick={() => {
                    setDeclining(refund);
                    setDeclineReason('');
                  }}
                >
                  Decline
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <Modal
        isOpen={declining !== null}
        onClose={() => {
          setDeclining(null);
        }}
        title="Decline this refund"
        description="The person who asked for it will see your reason, so write something they can act on."
      >
        <div className="space-y-4">
          <Input
            id="decline-reason"
            value={declineReason}
            placeholder="For example, the goods were delivered and signed for"
            onChange={(event) => {
              setDeclineReason(event.target.value);
            }}
          />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeclining(null);
              }}
            >
              Keep it waiting
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={declineReason.trim().length < 4}
              isLoading={declining !== null && busyId === declining.id}
              loadingLabel="Saving"
              onClick={() => {
                if (declining) {
                  void decide(declining, false, declineReason.trim());
                }
              }}
            >
              Decline the refund
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
