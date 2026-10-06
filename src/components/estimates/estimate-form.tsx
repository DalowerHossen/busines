// src/components/estimates/estimate-form.tsx
// Writing a quotation: who it is for, how long it stands, what is on it and
// what it comes to. The totals follow the lines as they are typed.

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
import { createEstimate } from '@/features/estimates/actions/create-estimate';
import { updateEstimate } from '@/features/estimates/actions/update-estimate';
import type { EstimateDetail } from '@/features/estimates/types';
import { documentAmountsOf } from '@/features/invoices/line-math';
import type { InvoiceFormData } from '@/features/invoices/types';
import { addDaysIso, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface EstimateFormProps {
  /** Draft being edited, or undefined when writing a new quotation. */
  estimate?: EstimateDetail;
  /** The clients, catalogue and tax rates this company has. */
  formData: InvoiceFormData;
  /** Currency the company bills in, used as the default. */
  defaultCurrency: string;
}

/** How long a quotation stands by default. */
const DEFAULT_VALIDITY_DAYS = 30;

/**
 * Builds the starting lines of the builder.
 *
 * @param estimate Draft being edited, when there is one.
 * @returns The lines to show.
 */
function toLineDrafts(estimate: EstimateDetail | undefined): InvoiceLineDraft[] {
  if (estimate === undefined || estimate.lines.length === 0) {
    return [emptyInvoiceLine()];
  }

  return estimate.lines.map((line, index) => ({
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
 * Renders the estimate builder.
 *
 * @param props The draft being edited and the lists it draws from.
 * @returns The rendered builder.
 */
export function EstimateForm({ estimate, formData, defaultCurrency }: EstimateFormProps) {
  const router = useRouter();
  const isEditing = estimate !== undefined;

  const [clientId, setClientId] = useState(estimate?.clientId ?? formData.clients[0]?.id ?? '');
  const [title, setTitle] = useState(estimate?.title ?? '');
  const [currency, setCurrency] = useState(estimate?.currency ?? defaultCurrency);
  const [issueDate, setIssueDate] = useState(estimate?.issueDate ?? todayIso());
  const [validUntil, setValidUntil] = useState(
    estimate?.validUntil ?? addDaysIso(todayIso(), DEFAULT_VALIDITY_DAYS)
  );
  const [shippingAmount, setShippingAmount] = useState(estimate?.shippingAmount ?? '0.00');
  const [notes, setNotes] = useState(estimate?.notes ?? '');
  const [termsAndConditions, setTermsAndConditions] = useState(estimate?.termsAndConditions ?? '');
  const [footerNote, setFooterNote] = useState(estimate?.footerNote ?? '');
  const [lines, setLines] = useState<InvoiceLineDraft[]>(() => toLineDrafts(estimate));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const totals = useMemo(() => documentAmountsOf(lines, shippingAmount), [lines, shippingAmount]);

  const clientOptions = formData.clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));

  /**
   * Applies the billing currency of the chosen client.
   *
   * @param nextClientId Client chosen in the list.
   * @returns Nothing.
   */
  function applyClient(nextClientId: string): void {
    setClientId(nextClientId);

    const client = formData.clients.find((entry) => entry.id === nextClientId);

    if (client !== undefined && client.currency !== null) {
      setCurrency(client.currency);
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
      title,
      currency,
      issueDate,
      validUntil,
      notes,
      termsAndConditions,
      footerNote,
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
      ? await updateEstimate({ ...payload, estimateId: estimate.id })
      : await createEstimate(payload);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Draft saved.' : 'Draft estimate created.');
    router.push(`${ROUTES.estimates}/${result.data.estimateId}`);
    router.refresh();
  }

  if (formData.clients.length === 0) {
    return (
      <Alert tone="warning" title="Add a client first">
        A quotation is always addressed to someone. Add a client, then come back and the builder
        will fill the address details in for you.
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
        <Alert tone="danger" title="The estimate was not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who and how long</CardTitle>
          <CardDescription>
            The client address is frozen onto the document the moment the quotation is sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="estimate-client"
            label="Client"
            isRequired
            errors={fieldErrors['clientId']}
          >
            <Select
              id="estimate-client"
              name="clientId"
              options={clientOptions}
              value={clientId}
              disabled={isSubmitting}
              onChange={(event) => {
                applyClient(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="estimate-title"
            label="Title"
            hint="A short name for the work, such as the project it covers."
            errors={fieldErrors['title']}
          >
            <Input
              {...fieldAccessibilityProps('estimate-title', true, Boolean(fieldErrors['title']))}
              name="title"
              value={title}
              disabled={isSubmitting}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
          </FormField>

          <FormField id="estimate-currency" label="Currency" errors={fieldErrors['currency']}>
            <Input
              {...fieldAccessibilityProps(
                'estimate-currency',
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

          <FormField id="estimate-issue-date" label="Issue date" errors={fieldErrors['issueDate']}>
            <Input
              {...fieldAccessibilityProps(
                'estimate-issue-date',
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

          <FormField
            id="estimate-valid-until"
            label="Valid until"
            hint="After this date the quotation expires on its own."
            errors={fieldErrors['validUntil']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'estimate-valid-until',
                true,
                Boolean(fieldErrors['validUntil'])
              )}
              type="date"
              name="validUntil"
              value={validUntil}
              disabled={isSubmitting}
              onChange={(event) => {
                setValidUntil(event.target.value);
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
              Everything here is printed on the quotation the client receives.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              id="estimate-notes"
              label="Notes to the client"
              errors={fieldErrors['notes']}
            >
              <Textarea
                {...fieldAccessibilityProps('estimate-notes', false, Boolean(fieldErrors['notes']))}
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
              id="estimate-terms"
              label="Terms of the quotation"
              errors={fieldErrors['termsAndConditions']}
            >
              <Textarea
                {...fieldAccessibilityProps(
                  'estimate-terms',
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

            <FormField id="estimate-footer" label="Footer note" errors={fieldErrors['footerNote']}>
              <Textarea
                {...fieldAccessibilityProps(
                  'estimate-footer',
                  false,
                  Boolean(fieldErrors['footerNote'])
                )}
                name="footerNote"
                rows={2}
                value={footerNote}
                disabled={isSubmitting}
                onChange={(event) => {
                  setFooterNote(event.target.value);
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
              id="estimate-shipping"
              label="Delivery charge"
              errors={fieldErrors['shippingAmount']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'estimate-shipping',
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
