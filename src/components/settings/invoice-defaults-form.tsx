// src/components/settings/invoice-defaults-form.tsx
// How documents are numbered, what they say by default and how they look.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { updateInvoiceDefaults } from '@/features/settings/actions/update-invoice-defaults';
import type { CompanyProfileSettings } from '@/features/settings/types';

export interface InvoiceDefaultsFormProps {
  /** The defaults as they are stored today. */
  profile: CompanyProfileSettings;
  /** False when the signed in account may only read. */
  canEdit: boolean;
}

const RESET_OPTIONS = [
  { value: 'never', label: 'Keep counting forever' },
  { value: 'yearly', label: 'Start again each year' },
  { value: 'monthly', label: 'Start again each month' },
];

const TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic — the familiar business layout' },
  { value: 'modern', label: 'Modern — generous spacing, strong headings' },
  { value: 'minimal', label: 'Minimal — quiet and typographic' },
  { value: 'compact', label: 'Compact — fits long item lists on one page' },
];

const PAPER_OPTIONS = [
  { value: 'letter', label: 'Letter — North America' },
  { value: 'a4', label: 'A4 — most of the world' },
];

/**
 * Renders the document defaults form.
 *
 * @param props The stored defaults and whether they may be changed.
 * @returns The rendered form.
 */
export function InvoiceDefaultsForm({ profile, canEdit }: InvoiceDefaultsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    invoicePrefix: profile.invoicePrefix,
    estimatePrefix: profile.estimatePrefix,
    receiptPrefix: profile.receiptPrefix,
    numberPadding: String(profile.numberPadding),
    numberingResetPolicy: profile.numberingResetPolicy,
    defaultPaymentTermsDays: String(profile.defaultPaymentTermsDays),
    defaultNotes: profile.defaultNotes ?? '',
    defaultTerms: profile.defaultTerms ?? '',
    defaultFooterText: profile.defaultFooterText ?? '',
    brandPrimaryColor: profile.brandPrimaryColor,
    brandAccentColor: profile.brandAccentColor,
    invoiceTemplateKey: profile.invoiceTemplateKey,
    paperSize: profile.paperSize,
  });
  const [showPlatformBadge, setShowPlatformBadge] = useState(profile.showPlatformBadge);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Changes one field of the form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function change(key: keyof typeof values, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /**
   * Saves the defaults.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await updateInvoiceDefaults({ ...values, showPlatformBadge });
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Document settings saved. They apply to new documents.');
    router.refresh();
  }

  const sampleNumber = `${values.invoicePrefix}${'1'.padStart(
    Math.max(Number.parseInt(values.numberPadding, 10) || 0, 1),
    '0'
  )}`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-6"
    >
      {canEdit ? null : (
        <Alert tone="info" title="You are looking at these settings">
          Only the owner of the business can change them.
        </Alert>
      )}

      {formError ? (
        <Alert tone="danger" title="The settings were not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Numbering</CardTitle>
          <CardDescription>
            Numbers are given out in order and never reused, which is what an auditor expects. Your
            next invoice would be {sampleNumber}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="defaults-invoice-prefix"
            label="Invoice prefix"
            errors={fieldErrors['invoicePrefix']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-invoice-prefix',
                false,
                Boolean(fieldErrors['invoicePrefix'])
              )}
              value={values.invoicePrefix}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('invoicePrefix', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-estimate-prefix"
            label="Estimate prefix"
            errors={fieldErrors['estimatePrefix']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-estimate-prefix',
                false,
                Boolean(fieldErrors['estimatePrefix'])
              )}
              value={values.estimatePrefix}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('estimatePrefix', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-receipt-prefix"
            label="Receipt prefix"
            errors={fieldErrors['receiptPrefix']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-receipt-prefix',
                false,
                Boolean(fieldErrors['receiptPrefix'])
              )}
              value={values.receiptPrefix}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('receiptPrefix', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-padding"
            label="Digits in the number"
            hint="Four digits gives you INV-0001."
            errors={fieldErrors['numberPadding']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-padding',
                true,
                Boolean(fieldErrors['numberPadding'])
              )}
              type="number"
              min={0}
              max={12}
              value={values.numberPadding}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('numberPadding', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-reset"
            label="When the count restarts"
            errors={fieldErrors['numberingResetPolicy']}
          >
            <Select
              id="defaults-reset"
              options={RESET_OPTIONS}
              value={values.numberingResetPolicy}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('numberingResetPolicy', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-terms-days"
            label="Default payment terms in days"
            errors={fieldErrors['defaultPaymentTermsDays']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-terms-days',
                false,
                Boolean(fieldErrors['defaultPaymentTermsDays'])
              )}
              type="number"
              min={0}
              max={365}
              value={values.defaultPaymentTermsDays}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('defaultPaymentTermsDays', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What every document says</CardTitle>
          <CardDescription>
            Filled in automatically on new documents, and editable on each one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField
            id="defaults-notes"
            label="Default note to the client"
            errors={fieldErrors['defaultNotes']}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'defaults-notes',
                false,
                Boolean(fieldErrors['defaultNotes'])
              )}
              rows={3}
              value={values.defaultNotes}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('defaultNotes', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-terms"
            label="Terms and conditions"
            errors={fieldErrors['defaultTerms']}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'defaults-terms',
                false,
                Boolean(fieldErrors['defaultTerms'])
              )}
              rows={5}
              value={values.defaultTerms}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('defaultTerms', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-footer"
            label="Footer line"
            hint="A short thank you, or your registration details."
            errors={fieldErrors['defaultFooterText']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-footer',
                true,
                Boolean(fieldErrors['defaultFooterText'])
              )}
              value={values.defaultFooterText}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('defaultFooterText', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How documents look</CardTitle>
          <CardDescription>
            Your colours are applied to documents, emails and the pages your clients open.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="defaults-primary"
            label="Primary colour"
            errors={fieldErrors['brandPrimaryColor']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-primary',
                false,
                Boolean(fieldErrors['brandPrimaryColor'])
              )}
              value={values.brandPrimaryColor}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('brandPrimaryColor', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-accent"
            label="Accent colour"
            errors={fieldErrors['brandAccentColor']}
          >
            <Input
              {...fieldAccessibilityProps(
                'defaults-accent',
                false,
                Boolean(fieldErrors['brandAccentColor'])
              )}
              value={values.brandAccentColor}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('brandAccentColor', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="defaults-template"
            label="Document template"
            errors={fieldErrors['invoiceTemplateKey']}
          >
            <Select
              id="defaults-template"
              options={TEMPLATE_OPTIONS}
              value={values.invoiceTemplateKey}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('invoiceTemplateKey', event.target.value);
              }}
            />
          </FormField>

          <FormField id="defaults-paper" label="Paper size" errors={fieldErrors['paperSize']}>
            <Select
              id="defaults-paper"
              options={PAPER_OPTIONS}
              value={values.paperSize}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('paperSize', event.target.value);
              }}
            />
          </FormField>

          <div className="flex items-center gap-4 sm:col-span-2">
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-full border border-border"
              style={{ backgroundColor: values.brandPrimaryColor }}
            />
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-full border border-border"
              style={{ backgroundColor: values.brandAccentColor }}
            />
            <p className="text-sm text-muted-foreground">
              A preview of the two colours as your clients will see them.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Checkbox
              id="defaults-badge"
              label="Show a small credit to the billing platform"
              description="Turn this off for a completely unbranded document."
              checked={showPlatformBadge}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                setShowPlatformBadge(event.target.checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving" disabled={!canEdit}>
          Save document settings
        </Button>
      </div>
    </form>
  );
}
