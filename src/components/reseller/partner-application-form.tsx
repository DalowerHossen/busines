// src/components/reseller/partner-application-form.tsx
// How somebody applies to sell the platform under their own brand.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { applyReseller } from '@/features/resellers/actions/apply-reseller';

export interface PartnerApplicationFormProps {
  /** Address to use as the opening answer for contact. */
  defaultEmail: string;
  /** Country to use as the opening answer. */
  defaultCountry: string;
}

/**
 * Renders the partner application form.
 *
 * @param props Opening answers taken from the signed in account.
 * @returns The rendered card.
 */
export function PartnerApplicationForm({
  defaultEmail,
  defaultCountry,
}: PartnerApplicationFormProps) {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [slug, setSlug] = useState('');
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState('');
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [brandName, setBrandName] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Sends the application.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!hasAcceptedTerms) {
      setFailure('Accept the partner agreement before applying.');
      return;
    }

    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await applyReseller({
      partnerName,
      slug,
      contactEmail,
      contactPhone,
      countryCode,
      brandName,
      hasAcceptedTerms: true,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your application is with us.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sell this under your own brand</CardTitle>
        <CardDescription>
          Open accounts for your clients, set your own prices and keep the margin. You manage the
          accounts; you never see what is inside them, and neither does anybody else.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? (
            <Alert tone="danger" title="Your application was not sent">
              {failure}
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="partner-name"
              label="Your business name"
              errors={fieldErrors['partnerName'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'partner-name',
                  false,
                  (fieldErrors['partnerName'] ?? []).length > 0
                )}
                value={partnerName}
                onChange={(event) => {
                  setPartnerName(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="partner-slug"
              label="Partner address"
              hint="Lower case letters, numbers and hyphens. Used in your partner links."
              errors={fieldErrors['slug'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'partner-slug',
                  true,
                  (fieldErrors['slug'] ?? []).length > 0
                )}
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase());
                }}
              />
            </FormField>

            <FormField
              id="partner-email"
              label="Contact email"
              errors={fieldErrors['contactEmail'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'partner-email',
                  false,
                  (fieldErrors['contactEmail'] ?? []).length > 0
                )}
                type="email"
                value={contactEmail}
                onChange={(event) => {
                  setContactEmail(event.target.value);
                }}
              />
            </FormField>

            <FormField id="partner-phone" label="Telephone">
              <Input
                {...fieldAccessibilityProps('partner-phone', false, false)}
                value={contactPhone}
                onChange={(event) => {
                  setContactPhone(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="partner-country"
              label="Country"
              hint="Two letter country code, for example US or BD."
              errors={fieldErrors['countryCode'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps('partner-country', true, false)}
                value={countryCode}
                maxLength={2}
                onChange={(event) => {
                  setCountryCode(event.target.value.toUpperCase());
                }}
              />
            </FormField>

            <FormField
              id="partner-brand"
              label="Brand to show your clients"
              hint="Leave this empty to use your business name."
            >
              <Input
                {...fieldAccessibilityProps('partner-brand', true, false)}
                value={brandName}
                onChange={(event) => {
                  setBrandName(event.target.value);
                }}
              />
            </FormField>
          </div>

          <Checkbox
            label="I accept the partner agreement"
            description="You bill your clients, we bill you at wholesale, and either side can end the agreement with notice."
            checked={hasAcceptedTerms}
            onChange={(event) => {
              setHasAcceptedTerms(event.target.checked);
            }}
          />

          <Button type="submit" isLoading={isSaving} loadingLabel="Sending">
            Apply to become a partner
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
