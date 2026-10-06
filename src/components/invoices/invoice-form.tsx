// src/components/invoices/invoice-form.tsx
// Writing an invoice: who it is for, when it is due, what is on it and what it
// comes to. The totals follow the lines as they are typed.

'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import {
  InvoiceLineEditor,
  emptyInvoiceLine,
  type InvoiceLineDraft,
} from '@/components/invoices/invoice-line-editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { createInvoice } from '@/features/invoices/actions/create-invoice';
import { updateInvoice } from '@/features/invoices/actions/update-invoice';
import { documentAmountsOf } from '@/features/invoices/line-math';
import type { InvoiceDetail, InvoiceFormData } from '@/features/invoices/types';
import { addDaysIso, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface InvoiceFormProps {
  /** Draft being edited, or undefined when writing a new invoice. */
  invoice?: InvoiceDetail;
  /** The clients, catalogue and tax rates this company has. */
  formData: InvoiceFormData;
  /** Currency the company bills in, used as the default. */
  defaultCurrency: string;
}

/**
 * Builds the starting lines of the builder.
 *
 * @param invoice Draft being edited, when there is one.
 * @returns The lines to show.
 */
function toLineDrafts(invoice: InvoiceDetail | undefined): InvoiceLineDraft[] {
  if (invoice === undefined || invoice.lines.length === 0) {
    return [emptyInvoiceLine()];
  }

  return invoice.lines.map((line, index) => ({
    key: `line-${index}-${line.id}`,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitLabel: line.unitLabel ?? '',
    discountValue: Number.parseFloat(line.discountValue) > 0 ? line.discountValue : '',
    taxRateId: line.taxRateId ?? '',
    taxPercentage: line.taxPercentage,
    productId: line.productId ?? '',
  }));
}

/**
 * Renders the invoice builder.
 *
 * @param props The draft being edited and the lists it draws from.
 * @returns The rendered builder.
 */
export function InvoiceForm({ invoice, formData, defaultCurrency }: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = invoice !== undefined;

  const [clientId, setClientId] = useState(invoice?.clientId ?? formData.clients[0]?.id ?? '');
  const [currency, setCurrency] = useState(invoice?.currency ?? defaultCurrency);
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? addDaysIso(todayIso(), 14));
  const [purchaseOrderReference, setPurchaseOrderReference] = useState(
    invoice?.purchaseOrderReference ?? ''
  );
  const [shippingAmount, setShippingAmount] = useState(invoice?.shippingAmount ?? '0.00');
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [termsAndConditions, setTermsAndConditions] = useState(invoice?.termsAndConditions ?? '');
  const [internalMemo, setInternalMemo] = useState(invoice?.internalMemo ?? '');
  const [lines, setLines] = useState<InvoiceLineDraft[]>(() => toLineDrafts(invoice));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const totals = useMemo(() => documentAmountsOf(lines, shippingAmount), [lines, shippingAmount]);

  const clientOptions = formData.clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));

  /**
   * Applies the billing defaults of the chosen client.
   *
   * @param nextClientId Client chosen in the list.
   * @returns Nothing.
   */
  function applyClient(nextClientId: string): void {
    setClientId(nextClientId);

    const client = formData.clients.find((entry) => entry.id === nextClientId);

    if (client === undefined) {
      return;
    }

    if (client.currency !== null) {
      setCurrency(client.currency);
    }

    if (client.paymentTermsDays !== null) {
      setDueDate(addDaysIso(issueDate, client.paymentTermsDays));
    }
  }

  /**
   * Saves the draft and opens it.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      clientId,
      currency,
      issueDate,
      dueDate,
      purchaseOrderReference,
      notes,
      termsAndConditions,
      internalMemo,
      shippingAmount,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitLabel: line.unitLabel,
        discountValue: line.discountValue,
        taxPercentage: line.taxPercentage,
        productId: line.productId,
        taxRateId: line.taxRateId,
      })),
    };

    const result = isEditing
      ? await updateInvoice({ ...payload, invoiceId: invoice.id })
      : await createInvoice(payload);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Draft saved.' : 'Draft invoice created.');
    router.push(`${ROUTES.invoices}/${result.data.invoiceId}`);
    router.refresh();
  }

  if (formData.clients.length === 0) {
    return (
      <Alert tone="warning" title="Add a client first">
        An invoice is always addressed to someone. Add a client, then come back and the builder will
        fill the address and payment terms in for you.
      </Alert>
    );
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
        <Alert tone="danger" title="The invoice was not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who and when</CardTitle>
          <CardDescription>
            The client address and tax details are frozen onto the document the moment you issue it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="invoice-client" label="Client" isRequired errors={fieldErrors['clientId']}>
            <Select
              id="invoice-client"
              name="clientId"
              options={clientOptions}
              value={clientId}
              disabled={isSubmitting}
              onChange={(event) => {
                applyClient(event.target.value);
              }}
            />
          </FormField>

          <FormField id="invoice-currency" label="Currency" errors={fieldErrors['currency']}>
            <Input
              {...fieldAccessibilityProps(
                'invoice-currency',
                false,
                Boolean(fieldErrors['currency'])
              )}
              name="currency"
              maxLength={3}
              value={currency}
              disabled={isSubmitting}
              onChange={(event) => {
                setCurrency(event.target.value.toUpperCase());
              }}
            />
          </FormField>

          <FormField id="invoice-issue-date" label="Issue date" errors={fieldErrors['issueDate']}>
            <Input
              {...fieldAccessibilityProps(
                'invoice-issue-date',
                false,
                Boolean(fieldErrors['issueDate'])
              )}
              type="date"
              name="issueDate"
              value={issueDate}
              disabled={isSubmitting}
              onChange={(event) => {
                setIssueDate(event.target.value);
              }}
            />
          </FormField>

          <FormField id="invoice-due-date" label="Due date" errors={fieldErrors['dueDate']}>
            <Input
              {...fieldAccessibilityProps(
                'invoice-due-date',
                false,
                Boolean(fieldErrors['dueDate'])
              )}
              type="date"
              name="dueDate"
              value={dueDate}
              disabled={isSubmitting}
              onChange={(event) => {
                setDueDate(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="invoice-po"
            label="Purchase order reference"
            hint="Many buyers will not pay an invoice without their own order number on it."
            errors={fieldErrors['purchaseOrderReference']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'invoice-po',
                true,
                Boolean(fieldErrors['purchaseOrderReference'])
              )}
              name="purchaseOrderReference"
              value={purchaseOrderReference}
              disabled={isSubmitting}
              onChange={(event) => {
                setPurchaseOrderReference(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            Pick an item from your catalogue or write the line yourself. Everything is priced in
            {` ${currency}`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceLineEditor
            lines={lines}
            products={formData.products}
            taxRates={formData.taxRates}
            currency={currency}
            onChange={setLines}
            fieldErrors={fieldErrors}
            isDisabled={isSubmitting}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Notes and terms</CardTitle>
            <CardDescription>
              Notes and terms are printed on the invoice. The memo is only ever seen by your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField id="invoice-notes" label="Notes to the client" errors={fieldErrors['notes']}>
              <Textarea
                {...fieldAccessibilityProps('invoice-notes', false, Boolean(fieldErrors['notes']))}
                name="notes"
                rows={3}
                value={notes}
                disabled={isSubmitting}
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="invoice-terms"
              label="Payment terms"
              errors={fieldErrors['termsAndConditions']}
            >
              <Textarea
                {...fieldAccessibilityProps(
                  'invoice-terms',
                  false,
                  Boolean(fieldErrors['termsAndConditions'])
                )}
                name="termsAndConditions"
                rows={3}
                value={termsAndConditions}
                disabled={isSubmitting}
                onChange={(event) => {
                  setTermsAndConditions(event.target.value);
                }}
              />
            </FormField>

            <FormField id="invoice-memo" label="Internal memo" errors={fieldErrors['internalMemo']}>
              <Textarea
                {...fieldAccessibilityProps(
                  'invoice-memo',
                  false,
                  Boolean(fieldErrors['internalMemo'])
                )}
                name="internalMemo"
                rows={2}
                value={internalMemo}
                disabled={isSubmitting}
                onChange={(event) => {
                  setInternalMemo(event.target.value);
                }}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              id="invoice-shipping"
              label="Delivery charge"
              errors={fieldErrors['shippingAmount']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'invoice-shipping',
                  false,
                  Boolean(fieldErrors['shippingAmount'])
                )}
                type="number"
                min={0}
                step={0.01}
                name="shippingAmount"
                value={shippingAmount}
                disabled={isSubmitting}
                onChange={(event) => {
                  setShippingAmount(event.target.value);
                }}
              />
            </FormField>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular">{formatMoney(totals.discount, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular">{formatMoney(totals.tax, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular">{formatMoney(totals.shipping, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-foreground">
                <dt>Total</dt>
                <dd className="tabular">{formatMoney(totals.total, currency)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

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
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
          {isEditing ? 'Save draft' : 'Create draft'}
        </Button>
      </div>
    </form>
  );
}
