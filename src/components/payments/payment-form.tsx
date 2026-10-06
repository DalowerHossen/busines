// src/components/payments/payment-form.tsx
// Recording money received. Choosing an invoice fills the amount with whatever
// is still owed on it, which is what happens nine times out of ten.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { recordPayment } from '@/features/payments/actions/record-payment';
import type { OpenInvoiceOption } from '@/features/payments/types';
import { formatDate, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { PAYMENT_METHOD_TYPES } from '@/types/enums';

export interface PaymentFormProps {
  /** Invoices that still have a balance. */
  invoices: readonly OpenInvoiceOption[];
  /** Invoice chosen before the page opened, when there was one. */
  preselectedInvoiceId?: string;
  /** Currency the company bills in, used when no invoice is chosen. */
  defaultCurrency: string;
}

/**
 * Renders the record payment form.
 *
 * @param props The open invoices and the default currency.
 * @returns The rendered form.
 */
export function PaymentForm({ invoices, preselectedInvoiceId, defaultCurrency }: PaymentFormProps) {
  const router = useRouter();
  const initialInvoice = invoices.find((entry) => entry.id === preselectedInvoiceId);

  const [invoiceId, setInvoiceId] = useState(initialInvoice?.id ?? '');
  const [amount, setAmount] = useState(initialInvoice?.balanceDue ?? '0.00');
  const [methodType, setMethodType] = useState('bank_transfer');
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [gatewayFeeAmount, setGatewayFeeAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const chosenInvoice = invoices.find((entry) => entry.id === invoiceId);
  const currency = chosenInvoice?.currency ?? defaultCurrency;

  const invoiceOptions = [
    { value: '', label: 'Money on account, not against an invoice' },
    ...invoices.map((invoice) => ({
      value: invoice.id,
      label: `${invoice.invoiceNumber ?? 'Draft'} — ${invoice.clientName} — ${formatMoney(
        invoice.balanceDue,
        invoice.currency
      )} due ${formatDate(invoice.dueDate)}`,
    })),
  ];

  const methodOptions = PAYMENT_METHOD_TYPES.map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));

  /**
   * Chooses an invoice and offers its outstanding balance as the amount.
   *
   * @param nextInvoiceId Invoice chosen in the list.
   * @returns Nothing.
   */
  function applyInvoice(nextInvoiceId: string): void {
    setInvoiceId(nextInvoiceId);

    const invoice = invoices.find((entry) => entry.id === nextInvoiceId);

    if (invoice !== undefined) {
      setAmount(invoice.balanceDue);
    }
  }

  /**
   * Records the payment and opens it.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await recordPayment({
      invoiceId,
      amount,
      methodType,
      provider: 'manual',
      receivedOn,
      reference,
      gatewayFeeAmount,
      payerName,
      payerEmail,
      notes,
    });

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Payment recorded.');
    router.push(`${ROUTES.payments}/${result.data.paymentId}`);
    router.refresh();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-6"
    >
      {formError ? (
        <Alert tone="danger" title="The payment was not recorded">
          {formError}
        </Alert>
      ) : null}

      {invoices.length === 0 ? (
        <Alert tone="info" title="No invoice is waiting for money">
          You can still record the payment on account. It will sit unallocated until an invoice is
          issued, and you can apply it then.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What came in</CardTitle>
          <CardDescription>
            Choosing an invoice settles it as soon as the payment is saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="payment-invoice"
            label="Invoice"
            errors={fieldErrors['invoiceId']}
            className="sm:col-span-2"
          >
            <Select
              id="payment-invoice"
              name="invoiceId"
              options={invoiceOptions}
              value={invoiceId}
              disabled={isSubmitting}
              onChange={(event) => {
                applyInvoice(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="payment-amount"
            label={`Amount in ${currency}`}
            isRequired
            errors={fieldErrors['amount']}
          >
            <Input
              {...fieldAccessibilityProps('payment-amount', false, Boolean(fieldErrors['amount']))}
              type="number"
              min={0}
              step={0.01}
              name="amount"
              value={amount}
              disabled={isSubmitting}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
            />
          </FormField>

          <FormField id="payment-date" label="Received on" errors={fieldErrors['receivedOn']}>
            <Input
              {...fieldAccessibilityProps(
                'payment-date',
                false,
                Boolean(fieldErrors['receivedOn'])
              )}
              type="date"
              name="receivedOn"
              value={receivedOn}
              disabled={isSubmitting}
              onChange={(event) => {
                setReceivedOn(event.target.value);
              }}
            />
          </FormField>

          <FormField id="payment-method" label="Method" errors={fieldErrors['methodType']}>
            <Select
              id="payment-method"
              name="methodType"
              options={methodOptions}
              value={methodType}
              disabled={isSubmitting}
              onChange={(event) => {
                setMethodType(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="payment-reference"
            label="Reference"
            hint="The bank reference or the transaction number, so it can be matched later."
            errors={fieldErrors['reference']}
          >
            <Input
              {...fieldAccessibilityProps(
                'payment-reference',
                true,
                Boolean(fieldErrors['reference'])
              )}
              name="reference"
              value={reference}
              disabled={isSubmitting}
              onChange={(event) => {
                setReference(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="payment-fee"
            label="Fee kept by the provider"
            errors={fieldErrors['gatewayFeeAmount']}
          >
            <Input
              {...fieldAccessibilityProps(
                'payment-fee',
                false,
                Boolean(fieldErrors['gatewayFeeAmount'])
              )}
              type="number"
              min={0}
              step={0.01}
              name="gatewayFeeAmount"
              value={gatewayFeeAmount}
              disabled={isSubmitting}
              onChange={(event) => {
                setGatewayFeeAmount(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who paid</CardTitle>
          <CardDescription>
            Useful when the name on the bank statement is not the name on the invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="payment-payer" label="Payer name" errors={fieldErrors['payerName']}>
            <Input
              {...fieldAccessibilityProps(
                'payment-payer',
                false,
                Boolean(fieldErrors['payerName'])
              )}
              name="payerName"
              value={payerName}
              disabled={isSubmitting}
              onChange={(event) => {
                setPayerName(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="payment-payer-email"
            label="Payer email"
            errors={fieldErrors['payerEmail']}
          >
            <Input
              {...fieldAccessibilityProps(
                'payment-payer-email',
                false,
                Boolean(fieldErrors['payerEmail'])
              )}
              type="email"
              name="payerEmail"
              value={payerEmail}
              disabled={isSubmitting}
              onChange={(event) => {
                setPayerEmail(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="payment-notes"
            label="Notes"
            errors={fieldErrors['notes']}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAccessibilityProps('payment-notes', false, Boolean(fieldErrors['notes']))}
              name="notes"
              rows={3}
              value={notes}
              disabled={isSubmitting}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => {
            router.back();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Recording">
          Record payment
        </Button>
      </div>
    </form>
  );
}
