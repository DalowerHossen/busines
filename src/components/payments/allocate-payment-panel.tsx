// src/components/payments/allocate-payment-panel.tsx
// Applies money that is sitting on a payment to one of the open invoices.
// Leaving the amount blank applies as much as both sides allow.

'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { allocatePayment } from '@/features/payments/actions/allocate-payment';
import type { OpenInvoiceOption } from '@/features/payments/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface AllocatePaymentPanelProps {
  /** Payment the money comes from. */
  paymentId: string;
  /** Currency of the payment. */
  currency: string;
  /** Amount still waiting to be applied. */
  unallocatedAmount: string;
  /** Client the payment belongs to, used to put their invoices first. */
  clientId: string | null;
  /** Invoices that still owe money. */
  invoices: readonly OpenInvoiceOption[];
  /** False when the signed in account may not change allocations. */
  canEdit: boolean;
}

/**
 * Renders the form that applies unallocated money to an invoice.
 *
 * @param props The payment, what is left on it and the invoices on offer.
 * @returns The rendered panel.
 */
export function AllocatePaymentPanel({
  paymentId,
  currency,
  unallocatedAmount,
  clientId,
  invoices,
  canEdit,
}: AllocatePaymentPanelProps) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const matching = invoices.filter(
      (invoice) =>
        invoice.currency === currency && (clientId === null || invoice.clientId === clientId)
    );

    return matching.length > 0
      ? matching
      : invoices.filter((invoice) => invoice.currency === currency);
  }, [invoices, currency, clientId]);

  const options = useMemo(
    () => [
      { value: '', label: 'Choose an invoice' },
      ...candidates.map((invoice) => ({
        value: invoice.id,
        label: `${invoice.invoiceNumber ?? 'Draft'} · ${invoice.clientName} · ${formatMoney(
          invoice.balanceDue,
          invoice.currency
        )} due ${formatDate(invoice.dueDate)}`,
      })),
    ],
    [candidates]
  );

  const remaining = Number.parseFloat(unallocatedAmount);

  /**
   * Sends the allocation to the server.
   *
   * @param event Submit event from the panel form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    if (invoiceId === '') {
      setFormError('Choose the invoice this money belongs to.');
      return;
    }

    setIsSaving(true);
    const result = await allocatePayment({ paymentId, invoiceId, amount });
    setIsSaving(false);

    if (!result.success) {
      setFormError(result.error);
      notify.error(result.error);
      return;
    }

    notify.success(`Applied ${formatMoney(result.data.amount, currency)} to the invoice.`);
    setInvoiceId('');
    setAmount('');
    router.refresh();
  }

  if (remaining <= 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Allocation</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every penny of this payment has been applied to an invoice. Reverse an allocation below if
          something needs to move.
        </p>
      </section>
    );
  }

  if (candidates.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Allocation</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatMoney(unallocatedAmount, currency)} is waiting, but there is no open invoice in{' '}
          {currency} to apply it to. Issue an invoice first and the money can be applied here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">Apply this money</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatMoney(unallocatedAmount, currency)} is waiting to be applied.
      </p>

      {formError === null ? null : (
        <div className="mt-4">
          <Alert tone="danger" title="The money could not be applied">
            {formError}
          </Alert>
        </div>
      )}

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <FormField id="allocation-invoice" label="Invoice" isRequired>
          <Select
            options={options}
            value={invoiceId}
            disabled={!canEdit || isSaving}
            onChange={(event) => {
              setInvoiceId(event.target.value);
            }}
            {...fieldAccessibilityProps('allocation-invoice', false, false)}
          />
        </FormField>

        <FormField
          id="allocation-amount"
          label="Amount"
          hint="Leave blank to apply as much as the invoice still owes."
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            disabled={!canEdit || isSaving}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            {...fieldAccessibilityProps('allocation-amount', true, false)}
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
          loadingLabel="Applying"
          disabled={!canEdit}
        >
          Apply to invoice
        </Button>
      </form>
    </section>
  );
}
