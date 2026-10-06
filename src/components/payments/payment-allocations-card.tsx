// src/components/payments/payment-allocations-card.tsx
// Where this payment has been applied, and the way back out: an allocation
// can be reversed with a reason, which is kept in the audit trail.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
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
import { ROUTES } from '@/config/app';
import { reverseAllocation } from '@/features/payments/actions/reverse-allocation';
import type { PaymentAllocationRecord } from '@/features/payments/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface PaymentAllocationsCardProps {
  /** Allocations recorded against the payment. */
  allocations: readonly PaymentAllocationRecord[];
  /** Currency the amounts are shown in. */
  currency: string;
  /** False when the signed in account may not change allocations. */
  canEdit: boolean;
}

/**
 * Renders the allocation history of one payment.
 *
 * @param props The allocations and what the account may do.
 * @returns The rendered card.
 */
export function PaymentAllocationsCard({
  allocations,
  currency,
  canEdit,
}: PaymentAllocationsCardProps) {
  const router = useRouter();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Closes the reversal question and clears what was typed.
   *
   * @returns Nothing.
   */
  function closeDialog(): void {
    setTargetId(null);
    setReason('');
    setFieldError(null);
  }

  /**
   * Reverses the chosen allocation.
   *
   * @returns Nothing.
   */
  async function confirmReversal(): Promise<void> {
    if (targetId === null) {
      return;
    }

    if (reason.trim().length < 3) {
      setFieldError('Give a short reason so the audit trail explains itself.');
      return;
    }

    setIsWorking(true);
    const result = await reverseAllocation({ allocationId: targetId, reason: reason.trim() });
    setIsWorking(false);

    if (!result.success) {
      setFieldError(result.error);
      notify.error(result.error);
      return;
    }

    notify.success('Allocation reversed. The money is available again.');
    closeDialog();
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">Where this money went</h2>

      {allocations.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Not applied yet"
            description="This payment is on record but has not been matched to an invoice. Apply it above and the invoice balance updates straight away."
          />
        </div>
      ) : (
        <div className="mt-4">
          <Table caption="Invoices this payment has been applied to">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Invoice</TableHead>
                <TableHead scope="col">Applied</TableHead>
                <TableHead scope="col" isNumeric>
                  Amount
                </TableHead>
                <TableHead scope="col">State</TableHead>
                <TableHead scope="col">
                  <span className="visually-hidden">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    <Link
                      href={`${ROUTES.invoices}/${allocation.invoiceId}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {allocation.invoiceNumber ?? 'Draft invoice'}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDateTime(allocation.allocatedAt)}</TableCell>
                  <TableCell isNumeric>{formatMoney(allocation.amount, currency)}</TableCell>
                  <TableCell>
                    {allocation.reversedAt === null ? (
                      <Badge tone="success">Applied</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge tone="neutral">Reversed</Badge>
                        {allocation.reversalReason === null ? null : (
                          <p className="text-xs text-muted-foreground">
                            {allocation.reversalReason}
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {allocation.reversedAt === null ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={!canEdit}
                        onClick={() => {
                          setTargetId(allocation.id);
                        }}
                      >
                        Reverse
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={targetId !== null}
        onClose={closeDialog}
        title="Reverse this allocation?"
        description="The invoice balance goes back up and the money becomes available to apply elsewhere."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Reversing"
              onClick={() => {
                void confirmReversal();
              }}
            >
              Reverse allocation
            </Button>
          </>
        }
      >
        <FormField
          id="reversal-reason"
          label="Reason"
          isRequired
          errors={fieldError === null ? undefined : [fieldError]}
        >
          <Textarea
            rows={3}
            value={reason}
            isInvalid={fieldError !== null}
            onChange={(event) => {
              setReason(event.target.value);
              setFieldError(null);
            }}
            {...fieldAccessibilityProps('reversal-reason', false, fieldError !== null)}
          />
        </FormField>
      </Modal>
    </section>
  );
}
