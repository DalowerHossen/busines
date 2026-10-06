// src/components/settings/company-profile-form.tsx
// The business identity: who you are, where you trade from, the numbers a
// compliant invoice has to carry, and where clients should send the money.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { COUNTRIES } from '@/config/countries';
import { updateCompanyProfile } from '@/features/settings/actions/update-company-profile';
import type { CompanyProfileSettings } from '@/features/settings/types';

export interface CompanyProfileFormProps {
  /** The profile as it is stored today. */
  profile: CompanyProfileSettings;
  /** False when the signed in account may only read. */
  canEdit: boolean;
}

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
}));

/**
 * Renders the business profile form.
 *
 * @param props The stored profile and whether it may be changed.
 * @returns The rendered form.
 */
export function CompanyProfileForm({ profile, canEdit }: CompanyProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    legalName: profile.legalName,
    tradeName: profile.tradeName ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
    supportEmail: profile.supportEmail ?? '',
    addressLine1: profile.addressLine1 ?? '',
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    postalCode: profile.postalCode ?? '',
    countryCode: profile.countryCode,
    taxId: profile.taxId ?? '',
    vatNumber: profile.vatNumber ?? '',
    registrationNumber: profile.registrationNumber ?? '',
    taxRegistrationLabel: profile.taxRegistrationLabel,
    bankName: profile.bankName ?? '',
    bankAccountName: profile.bankAccountName ?? '',
    bankAccountNumber: profile.bankAccountNumber ?? '',
    bankRoutingNumber: profile.bankRoutingNumber ?? '',
    bankSwiftCode: profile.bankSwiftCode ?? '',
    bankIban: profile.bankIban ?? '',
    remitToInstructions: profile.remitToInstructions ?? '',
  });
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
   * Saves the profile.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await updateCompanyProfile(values);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Business profile saved. New documents will use these details.');
    router.refresh();
  }

  /**
   * Renders one text field of the form.
   *
   * @param key Field being rendered.
   * @param label Label shown above the control.
   * @param hint Optional explanation under the label.
   * @returns The rendered field.
   */
  function field(key: keyof typeof values, label: string, hint?: string) {
    const id = `profile-${key}`;
    const errors = fieldErrors[key];

    return (
      <FormField id={id} label={label} hint={hint} errors={errors}>
        <Input
          {...fieldAccessibilityProps(id, hint !== undefined, Boolean(errors))}
          name={key}
          value={values[key]}
          disabled={isSubmitting || !canEdit}
          onChange={(event) => {
            change(key, event.target.value);
          }}
        />
      </FormField>
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
      {canEdit ? null : (
        <Alert tone="info" title="You are looking at these settings">
          Only the owner of the business can change them.
        </Alert>
      )}

      {formError ? (
        <Alert tone="danger" title="The profile was not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who you are</CardTitle>
          <CardDescription>
            These details head every invoice, estimate and receipt you send.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {field('legalName', 'Registered name')}
          {field('tradeName', 'Trading name', 'Used when you trade under a different name.')}
          {field('email', 'Billing email')}
          {field('supportEmail', 'Support email')}
          {field('phone', 'Phone')}
          {field('website', 'Website')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where you trade from</CardTitle>
          <CardDescription>
            The registered address decides how tax is applied on your invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {field('addressLine1', 'Address line one')}
          {field('addressLine2', 'Address line two')}
          {field('city', 'City')}
          {field('stateRegion', 'State or region')}
          {field('postalCode', 'Postal code')}

          <FormField id="profile-country" label="Country" errors={fieldErrors['countryCode']}>
            <Select
              id="profile-country"
              name="countryCode"
              options={COUNTRY_OPTIONS}
              value={values.countryCode}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                change('countryCode', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statutory numbers</CardTitle>
          <CardDescription>
            Printing the right registration number is what makes an invoice acceptable to a large
            buyer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {field(
            'taxRegistrationLabel',
            'What this number is called',
            'For example Tax ID, VAT number or GSTIN.'
          )}
          {field('taxId', 'Tax number')}
          {field('vatNumber', 'VAT number')}
          {field('registrationNumber', 'Company registration number')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where the money should go</CardTitle>
          <CardDescription>
            Printed in the remit to block when a client pays by transfer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {field('bankName', 'Bank name')}
          {field('bankAccountName', 'Account name')}
          {field('bankAccountNumber', 'Account number')}
          {field('bankRoutingNumber', 'Routing or sort code')}
          {field('bankSwiftCode', 'SWIFT or BIC')}
          {field('bankIban', 'IBAN')}

          <div className="sm:col-span-2">
            <FormField
              id="profile-remit"
              label="Payment instructions"
              hint="Anything a client needs to know to pay you correctly."
              errors={fieldErrors['remitToInstructions']}
            >
              <Textarea
                {...fieldAccessibilityProps(
                  'profile-remit',
                  true,
                  Boolean(fieldErrors['remitToInstructions'])
                )}
                name="remitToInstructions"
                rows={3}
                value={values.remitToInstructions}
                disabled={isSubmitting || !canEdit}
                onChange={(event) => {
                  change('remitToInstructions', event.target.value);
                }}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving" disabled={!canEdit}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
