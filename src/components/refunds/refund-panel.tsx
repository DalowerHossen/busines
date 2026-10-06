// src/components/refunds/refund-panel.tsx
// Giving money back from the page of the payment that received it.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { recordRefund } from '@/features/refunds/actions/record-refund';
import { formatMoney } from '@/lib/format';

export interface RefundPanelProps {
  /** Payment the money would come back from. */
  paymentId: string;
  /** What is left on the payment after earlier refunds. */
  refundableAmount: string;
  /** Currency of the payment. */
  currency: string;
}

/**
 * Renders the refund form on a payment page.
 *
 * @param props The payment and what is left to give back.
 * @returns The rendered panel.
 */
export function RefundPanel({ paymentId, refundableAmount, currency }: RefundPanelProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(refundableAmount);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const isSpent = Number.parseFloat(refundableAmount) <= 0;

  /**
   * Sends the refund request.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFailure(null);

    const result = await recordRefund({ paymentId, amount, reason });
    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(
      result.data.awaitsApproval
        ? 'Refund requested. The owner has to approve it before the money goes back.'
        : 'Refund recorded and the invoice has been reopened for that amount.'
    );
    setReason('');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Give money back</CardTitle>
        <CardDescription>
          {isSpent
            ? 'This payment has already been refunded in full.'
            : `Up to ${formatMoney(refundableAmount, currency)} can still be refunded. The invoices this payment settled are reopened for the amount you give back.`}
        </CardDescription>
      </CardHeader>

      {isSpent ? null : (
        <CardContent>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            {failure ? (
              <Alert tone="danger" title="The refund was not recorded">
                {failure}
              </Alert>
            ) : null}

            <FormField
              id="refund-amount"
              label="Amount to refund"
              hint={`Between 0.01 and ${refundableAmount}.`}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps('refund-amount', true, false)}
                type="number"
                step="0.01"
                min="0.01"
                max={refundableAmount}
                value={amount}
                disabled={isWorking}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="refund-reason"
              label="Why the money is going back"
              hint="Kept with the payment, and used if the client ever disputes it."
              isRequired
            >
              <Textarea
                {...fieldAccessibilityProps('refund-reason', true, false)}
                rows={3}
                value={reason}
                disabled={isWorking}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            </FormField>

            <Button
              type="submit"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Recording"
              disabled={reason.trim().length < 4}
            >
              Refund {formatMoney(amount === '' ? '0' : amount, currency)}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
