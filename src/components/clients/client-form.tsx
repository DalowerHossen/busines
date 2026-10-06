// src/components/clients/client-form.tsx
// The one form used to add a client and to edit one. It is grouped into the
// four things a biller actually needs: who they are, how to reach them, how
// they are billed, and the tax details that must appear on an invoice.

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
import { ROUTES } from '@/config/app';
import { COUNTRIES } from '@/config/countries';
import { CURRENCIES } from '@/config/currencies';
import { createClient } from '@/features/clients/actions/create-client';
import { updateClient } from '@/features/clients/actions/update-client';
import type { ClientDetail } from '@/features/clients/types';
import { CLIENT_STATUSES, CLIENT_TYPES, MESSAGE_CHANNELS } from '@/types/enums';

export interface ClientFormProps {
  /** Client being edited, or undefined when adding a new one. */
  client?: ClientDetail;
  /** Currency the company bills in, used as the default. */
  defaultCurrency: string;
  /** Country the company is registered in, used as the default. */
  defaultCountry: string;
}

interface ClientFormState {
  displayName: string;
  clientType: string;
  status: string;
  legalName: string;
  contactPerson: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  billingCurrency: string;
  defaultPaymentTermsDays: string;
  creditLimit: string;
  lateFeePercentage: string;
  taxId: string;
  vatNumber: string;
  registrationNumber: string;
  countryCode: string;
  isTaxExempt: boolean;
  taxExemptionReason: string;
  appliesReverseCharge: boolean;
  preferredContactChannel: string;
  sendReminders: boolean;
  statementDeliveryEnabled: boolean;
  portalNotes: string;
  internalNotes: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
}

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country.code, label: country.name }));

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.name}`,
}));

const TYPE_OPTIONS = CLIENT_TYPES.map((value) => ({
  value,
  label: value === 'business' ? 'Business' : 'Individual',
}));

const STATUS_LABELS: Record<(typeof CLIENT_STATUSES)[number], string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

const STATUS_OPTIONS = CLIENT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

const CHANNEL_LABELS: Record<(typeof MESSAGE_CHANNELS)[number], string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  telegram: 'Telegram',
  viber: 'Viber',
  in_app: 'In app only',
};

const CHANNEL_OPTIONS = MESSAGE_CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }));

/**
 * Builds the starting values of the form.
 *
 * @param client Client being edited, when there is one.
 * @param defaultCurrency Currency the company bills in.
 * @param defaultCountry Country the company is registered in.
 * @returns The initial field values.
 */
function toFormState(
  client: ClientDetail | undefined,
  defaultCurrency: string,
  defaultCountry: string
): ClientFormState {
  const billingAddress = client?.addresses.find((address) => address.addressType === 'billing');

  return {
    displayName: client?.displayName ?? '',
    clientType: client?.clientType ?? 'business',
    status: client?.status ?? 'active',
    legalName: client?.legalName ?? '',
    contactPerson: client?.contactPerson ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    mobile: client?.mobile ?? '',
    website: client?.website ?? '',
    billingCurrency: client?.billingCurrency ?? defaultCurrency,
    defaultPaymentTermsDays: String(client?.defaultPaymentTermsDays ?? 14),
    creditLimit: client?.creditLimit ?? '',
    lateFeePercentage: client?.lateFeePercentage ?? '',
    taxId: client?.taxId ?? '',
    vatNumber: client?.vatNumber ?? '',
    registrationNumber: client?.registrationNumber ?? '',
    countryCode: client?.countryCode ?? defaultCountry,
    isTaxExempt: client?.isTaxExempt ?? false,
    taxExemptionReason: client?.taxExemptionReason ?? '',
    appliesReverseCharge: client?.appliesReverseCharge ?? false,
    preferredContactChannel: client?.preferredContactChannel ?? 'email',
    sendReminders: client?.sendReminders ?? true,
    statementDeliveryEnabled: client?.statementDeliveryEnabled ?? false,
    portalNotes: client?.portalNotes ?? '',
    internalNotes: client?.internalNotes ?? '',
    addressLine1: billingAddress?.addressLine1 ?? '',
    addressLine2: billingAddress?.addressLine2 ?? '',
    city: billingAddress?.city ?? '',
    stateRegion: billingAddress?.stateRegion ?? '',
    postalCode: billingAddress?.postalCode ?? '',
  };
}

/**
 * Renders the add and edit form for a client.
 *
 * @param props The client being edited and the company defaults.
 * @returns The rendered form.
 */
export function ClientForm({ client, defaultCurrency, defaultCountry }: ClientFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormState>(() =>
    toFormState(client, defaultCurrency, defaultCountry)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isEditing = client !== undefined;

  /**
   * Updates one field of the form.
   *
   * @param field Field being changed.
   * @param value New value for that field.
   * @returns Nothing.
   */
  function setField<Field extends keyof ClientFormState>(
    field: Field,
    value: ClientFormState[Field]
  ): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Saves the client and returns to the list or the client page.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = { ...values, defaultPaymentTermsDays: values.defaultPaymentTermsDays || '0' };

    const result = isEditing
      ? await updateClient({ ...payload, clientId: client.id })
      : await createClient(payload);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Client saved.' : 'Client added.');
    router.push(`${ROUTES.clients}/${result.data.clientId}`);
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
        <Alert
          tone="danger"
          title={isEditing ? 'The client was not saved' : 'The client was not added'}
        >
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who they are</CardTitle>
          <CardDescription>
            The name you enter here is the name printed on every invoice you send this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="client-display-name"
            label="Client name"
            isRequired
            errors={fieldErrors['displayName']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'client-display-name',
                false,
                Boolean(fieldErrors['displayName'])
              )}
              name="displayName"
              autoFocus
              value={values.displayName}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('displayName', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-type" label="Client type" errors={fieldErrors['clientType']}>
            <Select
              id="client-type"
              name="clientType"
              options={TYPE_OPTIONS}
              value={values.clientType}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('clientType', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-status" label="Status" errors={fieldErrors['status']}>
            <Select
              id="client-status"
              name="status"
              options={STATUS_OPTIONS}
              value={values.status}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('status', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-legal-name"
            label="Registered legal name"
            hint="Only needed when it differs from the client name."
            errors={fieldErrors['legalName']}
          >
            <Input
              {...fieldAccessibilityProps(
                'client-legal-name',
                true,
                Boolean(fieldErrors['legalName'])
              )}
              name="legalName"
              value={values.legalName}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('legalName', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-contact-person"
            label="Main contact"
            errors={fieldErrors['contactPerson']}
          >
            <Input
              {...fieldAccessibilityProps(
                'client-contact-person',
                false,
                Boolean(fieldErrors['contactPerson'])
              )}
              name="contactPerson"
              value={values.contactPerson}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('contactPerson', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to reach them</CardTitle>
          <CardDescription>
            Invoices, reminders and statements are sent to the email address below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="client-email" label="Email address" errors={fieldErrors['email']}>
            <Input
              {...fieldAccessibilityProps('client-email', false, Boolean(fieldErrors['email']))}
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('email', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-channel"
            label="Preferred channel"
            errors={fieldErrors['preferredContactChannel']}
          >
            <Select
              id="client-channel"
              name="preferredContactChannel"
              options={CHANNEL_OPTIONS}
              value={values.preferredContactChannel}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('preferredContactChannel', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-phone" label="Telephone" errors={fieldErrors['phone']}>
            <Input
              {...fieldAccessibilityProps('client-phone', false, Boolean(fieldErrors['phone']))}
              name="phone"
              autoComplete="tel"
              value={values.phone}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('phone', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-mobile" label="Mobile" errors={fieldErrors['mobile']}>
            <Input
              {...fieldAccessibilityProps('client-mobile', false, Boolean(fieldErrors['mobile']))}
              name="mobile"
              value={values.mobile}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('mobile', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-website"
            label="Website"
            hint="Include https:// so the link opens correctly."
            errors={fieldErrors['website']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps('client-website', true, Boolean(fieldErrors['website']))}
              name="website"
              value={values.website}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('website', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-address-line1"
            label="Billing address"
            errors={fieldErrors['addressLine1']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'client-address-line1',
                false,
                Boolean(fieldErrors['addressLine1'])
              )}
              name="addressLine1"
              autoComplete="address-line1"
              value={values.addressLine1}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('addressLine1', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-address-line2"
            label="Address line two"
            errors={fieldErrors['addressLine2']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'client-address-line2',
                false,
                Boolean(fieldErrors['addressLine2'])
              )}
              name="addressLine2"
              autoComplete="address-line2"
              value={values.addressLine2}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('addressLine2', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-city" label="Town or city" errors={fieldErrors['city']}>
            <Input
              {...fieldAccessibilityProps('client-city', false, Boolean(fieldErrors['city']))}
              name="city"
              autoComplete="address-level2"
              value={values.city}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('city', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-state" label="State or region" errors={fieldErrors['stateRegion']}>
            <Input
              {...fieldAccessibilityProps(
                'client-state',
                false,
                Boolean(fieldErrors['stateRegion'])
              )}
              name="stateRegion"
              autoComplete="address-level1"
              value={values.stateRegion}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('stateRegion', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-postal-code" label="Postal code" errors={fieldErrors['postalCode']}>
            <Input
              {...fieldAccessibilityProps(
                'client-postal-code',
                false,
                Boolean(fieldErrors['postalCode'])
              )}
              name="postalCode"
              autoComplete="postal-code"
              value={values.postalCode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('postalCode', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-country" label="Country" errors={fieldErrors['countryCode']}>
            <Select
              id="client-country"
              name="countryCode"
              options={COUNTRY_OPTIONS}
              value={values.countryCode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('countryCode', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How they are billed</CardTitle>
          <CardDescription>
            These values are filled in for you every time you raise an invoice for this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="client-currency"
            label="Billing currency"
            errors={fieldErrors['billingCurrency']}
          >
            <Select
              id="client-currency"
              name="billingCurrency"
              options={CURRENCY_OPTIONS}
              value={values.billingCurrency}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('billingCurrency', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-terms"
            label="Payment terms in days"
            hint="Zero means the invoice is due on the day it is issued."
            errors={fieldErrors['defaultPaymentTermsDays']}
          >
            <Input
              {...fieldAccessibilityProps(
                'client-terms',
                true,
                Boolean(fieldErrors['defaultPaymentTermsDays'])
              )}
              type="number"
              min={0}
              max={365}
              step={1}
              name="defaultPaymentTermsDays"
              value={values.defaultPaymentTermsDays}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('defaultPaymentTermsDays', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-credit-limit"
            label="Credit limit"
            hint="Leave empty for no limit."
            errors={fieldErrors['creditLimit']}
          >
            <Input
              {...fieldAccessibilityProps(
                'client-credit-limit',
                true,
                Boolean(fieldErrors['creditLimit'])
              )}
              type="number"
              min={0}
              step={0.01}
              name="creditLimit"
              value={values.creditLimit}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('creditLimit', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-late-fee"
            label="Late fee percentage"
            errors={fieldErrors['lateFeePercentage']}
          >
            <Input
              {...fieldAccessibilityProps(
                'client-late-fee',
                false,
                Boolean(fieldErrors['lateFeePercentage'])
              )}
              type="number"
              min={0}
              max={100}
              step={0.01}
              name="lateFeePercentage"
              value={values.lateFeePercentage}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('lateFeePercentage', event.target.value);
              }}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              id="client-send-reminders"
              name="sendReminders"
              label="Send payment reminders to this client"
              description="Reminders follow the schedule set in your billing settings."
              checked={values.sendReminders}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('sendReminders', event.target.checked);
              }}
            />
            <Checkbox
              id="client-statements"
              name="statementDeliveryEnabled"
              label="Send a monthly statement of account"
              checked={values.statementDeliveryEnabled}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('statementDeliveryEnabled', event.target.checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax details</CardTitle>
          <CardDescription>
            Printed on the invoice where the law of the client country requires it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="client-tax-id"
            label="Tax identification number"
            errors={fieldErrors['taxId']}
          >
            <Input
              {...fieldAccessibilityProps('client-tax-id', false, Boolean(fieldErrors['taxId']))}
              name="taxId"
              value={values.taxId}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('taxId', event.target.value);
              }}
            />
          </FormField>

          <FormField id="client-vat" label="VAT number" errors={fieldErrors['vatNumber']}>
            <Input
              {...fieldAccessibilityProps('client-vat', false, Boolean(fieldErrors['vatNumber']))}
              name="vatNumber"
              value={values.vatNumber}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('vatNumber', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-registration"
            label="Company registration number"
            errors={fieldErrors['registrationNumber']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps(
                'client-registration',
                false,
                Boolean(fieldErrors['registrationNumber'])
              )}
              name="registrationNumber"
              value={values.registrationNumber}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('registrationNumber', event.target.value);
              }}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              id="client-tax-exempt"
              name="isTaxExempt"
              label="This client is exempt from tax"
              checked={values.isTaxExempt}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('isTaxExempt', event.target.checked);
              }}
            />
            <Checkbox
              id="client-reverse-charge"
              name="appliesReverseCharge"
              label="Apply the reverse charge on cross border sales"
              description="Used when the client accounts for the tax in their own country."
              checked={values.appliesReverseCharge}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('appliesReverseCharge', event.target.checked);
              }}
            />
          </div>

          {values.isTaxExempt ? (
            <FormField
              id="client-exemption-reason"
              label="Reason for exemption"
              isRequired
              errors={fieldErrors['taxExemptionReason']}
              className="sm:col-span-2"
            >
              <Input
                {...fieldAccessibilityProps(
                  'client-exemption-reason',
                  false,
                  Boolean(fieldErrors['taxExemptionReason'])
                )}
                name="taxExemptionReason"
                value={values.taxExemptionReason}
                disabled={isSubmitting}
                onChange={(event) => {
                  setField('taxExemptionReason', event.target.value);
                }}
              />
            </FormField>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Client notes appear on the invoice. Internal notes are only ever seen by your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="client-portal-notes"
            label="Notes shown to the client"
            errors={fieldErrors['portalNotes']}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'client-portal-notes',
                false,
                Boolean(fieldErrors['portalNotes'])
              )}
              name="portalNotes"
              rows={4}
              value={values.portalNotes}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('portalNotes', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="client-internal-notes"
            label="Internal notes"
            errors={fieldErrors['internalNotes']}
          >
            <Textarea
              {...fieldAccessibilityProps(
                'client-internal-notes',
                false,
                Boolean(fieldErrors['internalNotes'])
              )}
              name="internalNotes"
              rows={4}
              value={values.internalNotes}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('internalNotes', event.target.value);
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
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
          {isEditing ? 'Save client' : 'Add client'}
        </Button>
      </div>
    </form>
  );
}
