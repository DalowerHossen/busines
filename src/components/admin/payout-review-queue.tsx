// src/components/admin/payout-review-queue.tsx
// The payouts waiting for the platform team. Each one can be released, or
// refused with a reason that goes back to the business.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
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
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { reviewPayout } from '@/features/admin/actions/review-payout';
import type { PendingPayout } from '@/features/admin/queries/list-money-queue';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface PayoutReviewQueueProps {
  /** Payouts waiting for a decision, oldest first. */
  payouts: readonly PendingPayout[];
}

/**
 * Renders the payout queue.
 *
 * @param props The payouts waiting.
 * @returns The rendered queue.
 */
export function PayoutReviewQueue({ payouts }: PayoutReviewQueueProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<PendingPayout | null>(null);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [noteErrors, setNoteErrors] = useState<readonly string[]>([]);

  /**
   * Releases one payout.
   *
   * @param payout Payout being released.
   * @returns Nothing.
   */
  async function release(payout: PendingPayout): Promise<void> {
    setBusyId(payout.id);
    setFailure(null);

    const result = await reviewPayout({ payoutId: payout.id, isApproved: true });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Released. It is on its way to the provider.');
    router.refresh();
  }

  /**
   * Refuses the payout currently open in the dialog.
   *
   * @returns Nothing.
   */
  async function refuse(): Promise<void> {
    if (refusing === null) {
      return;
    }

    setBusyId(refusing.id);
    setFailure(null);
    setNoteErrors([]);

    const result = await reviewPayout({ payoutId: refusing.id, isApproved: false, note });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      setNoteErrors(result.fieldErrors?.note ?? []);
      return;
    }

    notify.success('Refused. The money is back in their balance.');
    setRefusing(null);
    setNote('');
    router.refresh();
  }

  if (payouts.length === 0) {
    return (
      <EmptyState
        title="No payout is waiting"
        description="Every request has been dealt with. New ones appear here the moment a business asks for its balance."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That payout was not changed">
          {failure}
        </Alert>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead isNumeric>Amount</TableHead>
              <TableHead isNumeric>They receive</TableHead>
              <TableHead>Asked</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <span className="visually-hidden">Decision</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell>{payout.companyName}</TableCell>
                <TableCell>
                  {payout.destinationLabel}
                  {payout.isVerifiedDestination ? null : (
                    <Badge tone="warning" className="ml-2">
                      Unverified
                    </Badge>
                  )}
                </TableCell>
                <TableCell isNumeric>{formatMoney(payout.amount, payout.currency)}</TableCell>
                <TableCell isNumeric>{formatMoney(payout.netAmount, payout.currency)}</TableCell>
                <TableCell>{formatDateTime(payout.requestedAt)}</TableCell>
                <TableCell>
                  <StatusBadge kind="payout" status={payout.status} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      isLoading={busyId === payout.id}
                      loadingLabel="Releasing"
                      onClick={() => {
                        void release(payout);
                      }}
                    >
                      Release
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRefusing(payout);
                      }}
                    >
                      Refuse
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={refusing !== null}
        onClose={() => {
          setRefusing(null);
        }}
        title="Refuse this payout"
        description="The reserved amount goes straight back to the business balance, and the reason you write is what they are told."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRefusing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={busyId !== null && busyId === refusing?.id}
              loadingLabel="Refusing"
              onClick={() => {
                void refuse();
              }}
            >
              Refuse payout
            </Button>
          </div>
        }
      >
        <FormField id="payout-refusal-note" label="Reason" errors={noteErrors} isRequired>
          <Textarea
            {...fieldAccessibilityProps('payout-refusal-note', false, noteErrors.length > 0)}
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </FormField>
      </Modal>
    </div>
  );
}
