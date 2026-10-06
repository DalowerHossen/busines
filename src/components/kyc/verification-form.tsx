// src/components/kyc/verification-form.tsx
// What a business tells us about itself before we collect money on its
// behalf. Saving and submitting are separate, so a half finished form is
// never lost.

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
import { saveVerification } from '@/features/kyc/actions/save-verification';
import type { KycVerification, LegalEntityType } from '@/features/kyc/types';
import { LEGAL_ENTITY_TYPES } from '@/features/kyc/types';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';

export interface VerificationFormProps {
  /** The check already started, or null when there is none yet. */
  verification: KycVerification | null;
  /** Country the business is registered in, used as the opening answer. */
  defaultCountry: string;
  /** Name the business trades under, used as the opening answer. */
  defaultLegalName: string;
  /** False once the check is with us and can no longer be edited. */
  isEditable: boolean;
}

const ENTITY_OPTIONS: readonly SelectOption[] = LEGAL_ENTITY_TYPES.map((value) => ({
  value,
  label: humanise(value),
}));

/**
 * Renders the identity check form.
 *
 * @param props The current answers and whether they may be changed.
 * @returns The rendered card.
 */
export function VerificationForm({
  verification,
  defaultCountry,
  defaultLegalName,
  isEditable,
}: VerificationFormProps) {
  const router = useRouter();
  const [legalEntityType, setLegalEntityType] = useState<LegalEntityType>(
    verification?.legalEntityType ?? 'company'
  );
  const [legalName, setLegalName] = useState(verification?.legalName ?? defaultLegalName);
  const [registrationNumber, setRegistrationNumber] = useState(
    verification?.registrationNumber ?? ''
  );
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState(
    verification?.taxIdentificationNumber ?? ''
  );
  const [incorporationCountry, setIncorporationCountry] = useState(
    verification?.incorporationCountry ?? defaultCountry
  );
  const [representativeName, setRepresentativeName] = useState(
    verification?.representativeName ?? ''
  );
  const [representativeRole, setRepresentativeRole] = useState(
    verification?.representativeRole ?? ''
  );
  const [representativeEmail, setRepresentativeEmail] = useState(
    verification?.representativeEmail ?? ''
  );
  const [representativePhone, setRepresentativePhone] = useState(
    verification?.representativePhone ?? ''
  );
  const [addressLine1, setAddressLine1] = useState(verification?.registeredAddressLine1 ?? '');
  const [city, setCity] = useState(verification?.registeredCity ?? '');
  const [postalCode, setPostalCode] = useState(verification?.registeredPostalCode ?? '');
  const [registeredCountry, setRegisteredCountry] = useState(
    verification?.registeredCountry ?? defaultCountry
  );
  const [businessDescription, setBusinessDescription] = useState(
    verification?.businessDescription ?? ''
  );
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState(
    verification?.expectedMonthlyVolume ?? ''
  );
  const [website, setWebsite] = useState(verification?.website ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the answers.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveVerification({
      ...(verification ? { verificationId: verification.id } : {}),
      legalEntityType,
      legalName,
      registrationNumber,
      taxIdentificationNumber,
      incorporationCountry,
      representativeName,
      representativeRole,
      representativeEmail,
      representativePhone,
      registeredAddressLine1: addressLine1,
      registeredCity: city,
      registeredPostalCode: postalCode,
      registeredCountry,
      businessDescription,
      ...(expectedMonthlyVolume.length > 0 ? { expectedMonthlyVolume } : {}),
      website,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your answers are saved. Nothing is sent to us until you submit.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>About the business</CardTitle>
        <CardDescription>
          These answers are checked against the papers you upload, so write the names exactly as
          they appear on the register.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? (
            <Alert tone="danger" title="Your answers were not saved">
              {failure}
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="kyc-entity" label="Kind of business" isRequired>
              <Select
                {...fieldAccessibilityProps('kyc-entity', false, false)}
                options={ENTITY_OPTIONS}
                value={legalEntityType}
                disabled={!isEditable}
                onChange={(event) => {
                  setLegalEntityType(event.target.value as LegalEntityType);
                }}
              />
            </FormField>

            <FormField
              id="kyc-legal-name"
              label="Registered name"
              errors={fieldErrors['legalName'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'kyc-legal-name',
                  false,
                  (fieldErrors['legalName'] ?? []).length > 0
                )}
                value={legalName}
                disabled={!isEditable}
                onChange={(event) => {
                  setLegalName(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-registration"
              label="Registration number"
              errors={fieldErrors['registrationNumber'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-registration', false, false)}
                value={registrationNumber}
                disabled={!isEditable}
                onChange={(event) => {
                  setRegistrationNumber(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-tax"
              label="Tax number"
              errors={fieldErrors['taxIdentificationNumber'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-tax', false, false)}
                value={taxIdentificationNumber}
                disabled={!isEditable}
                onChange={(event) => {
                  setTaxIdentificationNumber(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-incorporation-country"
              label="Registered in"
              hint="Two letter country code, for example US or BD."
              errors={fieldErrors['incorporationCountry'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps('kyc-incorporation-country', true, false)}
                value={incorporationCountry}
                maxLength={2}
                disabled={!isEditable}
                onChange={(event) => {
                  setIncorporationCountry(event.target.value.toUpperCase());
                }}
              />
            </FormField>

            <FormField id="kyc-website" label="Website" errors={fieldErrors['website'] ?? []}>
              <Input
                {...fieldAccessibilityProps('kyc-website', false, false)}
                value={website}
                disabled={!isEditable}
                onChange={(event) => {
                  setWebsite(event.target.value);
                }}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="kyc-rep-name"
              label="Person answering for the business"
              errors={fieldErrors['representativeName'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'kyc-rep-name',
                  false,
                  (fieldErrors['representativeName'] ?? []).length > 0
                )}
                value={representativeName}
                disabled={!isEditable}
                onChange={(event) => {
                  setRepresentativeName(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-rep-role"
              label="Their role"
              errors={fieldErrors['representativeRole'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-rep-role', false, false)}
                value={representativeRole}
                disabled={!isEditable}
                onChange={(event) => {
                  setRepresentativeRole(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-rep-email"
              label="Their email"
              errors={fieldErrors['representativeEmail'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'kyc-rep-email',
                  false,
                  (fieldErrors['representativeEmail'] ?? []).length > 0
                )}
                type="email"
                value={representativeEmail}
                disabled={!isEditable}
                onChange={(event) => {
                  setRepresentativeEmail(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-rep-phone"
              label="Their telephone"
              errors={fieldErrors['representativePhone'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-rep-phone', false, false)}
                value={representativePhone}
                disabled={!isEditable}
                onChange={(event) => {
                  setRepresentativePhone(event.target.value);
                }}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="kyc-address"
              label="Registered address"
              errors={fieldErrors['registeredAddressLine1'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-address', false, false)}
                value={addressLine1}
                disabled={!isEditable}
                onChange={(event) => {
                  setAddressLine1(event.target.value);
                }}
              />
            </FormField>

            <FormField id="kyc-city" label="City" errors={fieldErrors['registeredCity'] ?? []}>
              <Input
                {...fieldAccessibilityProps('kyc-city', false, false)}
                value={city}
                disabled={!isEditable}
                onChange={(event) => {
                  setCity(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-postal"
              label="Postal code"
              errors={fieldErrors['registeredPostalCode'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('kyc-postal', false, false)}
                value={postalCode}
                disabled={!isEditable}
                onChange={(event) => {
                  setPostalCode(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="kyc-country"
              label="Country"
              errors={fieldErrors['registeredCountry'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps('kyc-country', false, false)}
                value={registeredCountry}
                maxLength={2}
                disabled={!isEditable}
                onChange={(event) => {
                  setRegisteredCountry(event.target.value.toUpperCase());
                }}
              />
            </FormField>
          </div>

          <FormField
            id="kyc-description"
            label="What the business sells"
            hint="One or two sentences. This is what the card networks underwrite."
            errors={fieldErrors['businessDescription'] ?? []}
          >
            <Textarea
              {...fieldAccessibilityProps('kyc-description', true, false)}
              rows={3}
              value={businessDescription}
              disabled={!isEditable}
              onChange={(event) => {
                setBusinessDescription(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="kyc-volume"
            label="Expected monthly card volume"
            hint="An honest estimate. It is never used to cap you, only to size the account."
            errors={fieldErrors['expectedMonthlyVolume'] ?? []}
          >
            <Input
              {...fieldAccessibilityProps('kyc-volume', true, false)}
              type="number"
              step="0.01"
              min={0}
              value={expectedMonthlyVolume}
              disabled={!isEditable}
              onChange={(event) => {
                setExpectedMonthlyVolume(event.target.value);
              }}
            />
          </FormField>

          {isEditable ? (
            <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
              Save answers
            </Button>
          ) : (
            <Alert tone="info" title="These answers are with us">
              Nothing can be changed while the check is being looked at. Write to support if
              something here is wrong.
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
