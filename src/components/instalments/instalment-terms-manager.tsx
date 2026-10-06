// src/components/instalments/instalment-terms-manager.tsx
// Writing the terms the business is willing to be paid on, and switching
// them on and off. The terms the platform ships with are read only.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { saveInstalmentOffer } from '@/features/instalments/actions/save-offer';
import { setInstalmentOfferActive } from '@/features/instalments/actions/set-offer-active';
import type { InstalmentOfferRecord } from '@/features/instalments/types';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface InstalmentTermsManagerProps {
  /** The terms already on file. */
  offers: readonly InstalmentOfferRecord[];
  /** Currency the business bills in. */
  currency: string;
  /** True when the viewer may write terms. */
  canManage: boolean;
}

interface TermsForm {
  name: string;
  provider: string;
  description: string;
  instalmentCount: string;
  intervalUnit: string;
  intervalCount: string;
  downPaymentPercentage: string;
  interestRatePercentage: string;
  partnerFeePercentage: string;
  lateFeeAmount: string;
  gracePeriodDays: string;
  minimumInvoiceAmount: string;
  maximumInvoiceAmount: string;
  requiresApproval: boolean;
}

const PROVIDER_OPTIONS = [
  { value: 'self_financed', label: 'Financed by the business itself' },
  { value: 'klarna', label: 'Instalment partner one' },
  { value: 'afterpay', label: 'Instalment partner two' },
  { value: 'affirm', label: 'Instalment partner three' },
  { value: 'zip', label: 'Instalment partner four' },
  { value: 'tabby', label: 'Instalment partner five' },
  { value: 'tamara', label: 'Instalment partner six' },
  { value: 'custom_partner', label: 'A partner you have added yourself' },
];

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Months' },
  { value: 'week', label: 'Weeks' },
];

const EMPTY_FORM: TermsForm = {
  name: '',
  provider: 'self_financed',
  description: '',
  instalmentCount: '3',
  intervalUnit: 'month',
  intervalCount: '1',
  downPaymentPercentage: '0',
  interestRatePercentage: '0',
  partnerFeePercentage: '0',
  lateFeeAmount: '0',
  gracePeriodDays: '3',
  minimumInvoiceAmount: '50',
  maximumInvoiceAmount: '',
  requiresApproval: false,
};

/**
 * Renders the terms screen.
 *
 * @param props The terms, the currency and what the viewer may do.
 * @returns The rendered screen.
 */
export function InstalmentTermsManager({
  offers,
  currency,
  canManage,
}: InstalmentTermsManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<TermsForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});

  /**
   * Changes one field of the form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onChange(key: keyof TermsForm, value: string | boolean): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * Loads one set of terms into the form so it can be changed.
   *
   * @param offer Terms being edited.
   * @returns Nothing.
   */
  function onEdit(offer: InstalmentOfferRecord): void {
    setEditingId(offer.offerId);
    setFailure(null);
    setFieldErrors({});
    setForm({
      name: offer.name,
      provider: offer.provider,
      description: offer.description ?? '',
      instalmentCount: String(offer.instalmentCount),
      intervalUnit: offer.intervalUnit,
      intervalCount: String(offer.intervalCount),
      downPaymentPercentage: offer.downPaymentPercentage,
      interestRatePercentage: offer.interestRatePercentage,
      partnerFeePercentage: offer.partnerFeePercentage,
      lateFeeAmount: offer.lateFeeAmount,
      gracePeriodDays: String(offer.gracePeriodDays),
      minimumInvoiceAmount: offer.minimumInvoiceAmount,
      maximumInvoiceAmount: offer.maximumInvoiceAmount ?? '',
      requiresApproval: offer.requiresApproval,
    });
  }

  /**
   * Saves the terms in the form.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveInstalmentOffer({
      offerId: editingId ?? undefined,
      name: form.name,
      provider: form.provider,
      description: form.description.trim() === '' ? undefined : form.description.trim(),
      instalmentCount: form.instalmentCount,
      intervalUnit: form.intervalUnit,
      intervalCount: form.intervalCount,
      downPaymentPercentage: form.downPaymentPercentage,
      interestRatePercentage: form.interestRatePercentage,
      partnerFeePercentage: form.partnerFeePercentage,
      lateFeeAmount: form.lateFeeAmount,
      gracePeriodDays: form.gracePeriodDays,
      minimumInvoiceAmount: form.minimumInvoiceAmount,
      maximumInvoiceAmount:
        form.maximumInvoiceAmount.trim() === '' ? undefined : form.maximumInvoiceAmount,
      currency,
      requiresApproval: form.requiresApproval,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success(editingId === null ? 'Those terms are live.' : 'Those terms are updated.');
    setForm(EMPTY_FORM);
    setEditingId(null);
    router.refresh();
  }

  /**
   * Switches one set of terms on or off.
   *
   * @param offerId Terms being switched.
   * @param isActive True when they should be offered.
   * @returns Nothing.
   */
  async function onToggle(offerId: string, isActive: boolean): Promise<void> {
    const result = await setInstalmentOfferActive({ offerId, isActive });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(isActive ? 'Those terms are being offered again.' : 'Those terms are off.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Terms on file</CardTitle>
          <CardDescription>
            An invoice is only quoted terms that are switched on, in the right currency, and inside
            the amounts you have set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offers.length === 0 ? (
            <EmptyState
              title="No terms yet"
              description="Write your first set of terms below. Three monthly payments with no interest is the usual place to start."
            />
          ) : (
            <ul className="space-y-3">
              {offers.map((offer) => (
                <li
                  key={offer.offerId}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{offer.name}</p>
                      {offer.isPlatform ? (
                        <Badge tone="neutral">Supplied with the app</Badge>
                      ) : null}
                      {offer.requiresApproval ? (
                        <Badge tone="warning">Needs your approval</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {`${formatNumber(offer.instalmentCount)} payments every ${formatNumber(
                        offer.intervalCount
                      )} ${offer.intervalUnit === 'week' ? 'week' : 'month'}, ${humanise(
                        offer.provider
                      )}.`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {`Deposit ${offer.downPaymentPercentage}%, interest ${
                        offer.interestRatePercentage
                      }%, from ${formatMoney(offer.minimumInvoiceAmount, offer.currency)}${
                        offer.maximumInvoiceAmount === null
                          ? ''
                          : ` to ${formatMoney(offer.maximumInvoiceAmount, offer.currency)}`
                      }. ${formatNumber(offer.plansRunning)} arrangements use them.`}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Switch
                        checked={offer.isActive}
                        label="Offered"
                        onCheckedChange={(checked) => void onToggle(offer.offerId, checked)}
                      />
                      {offer.isPlatform ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(offer)}
                        >
                          Change these terms
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId === null ? 'Write new terms' : 'Change these terms'}</CardTitle>
            <CardDescription>
              Everything here is priced into the schedule the moment a client accepts, so the
              figures on the invoice and in your books always agree.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
              {failure === null ? null : (
                <Alert tone="danger" title="Those terms were not saved">
                  {failure}
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="terms-name"
                  label="Name the client sees"
                  isRequired
                  errors={fieldErrors.name}
                >
                  <Input
                    id="terms-name"
                    value={form.name}
                    placeholder="Three monthly payments"
                    onChange={(event) => onChange('name', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-provider" label="Who carries the risk">
                  <Select
                    id="terms-provider"
                    value={form.provider}
                    options={PROVIDER_OPTIONS}
                    onChange={(event) => onChange('provider', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="terms-count"
                  label="Number of payments"
                  isRequired
                  errors={fieldErrors.instalmentCount}
                >
                  <Input
                    id="terms-count"
                    type="number"
                    min={2}
                    max={60}
                    value={form.instalmentCount}
                    onChange={(event) => onChange('instalmentCount', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-unit" label="One payment every">
                  <div className="flex gap-2">
                    <Input
                      id="terms-unit"
                      type="number"
                      min={1}
                      max={12}
                      value={form.intervalCount}
                      onChange={(event) => onChange('intervalCount', event.target.value)}
                    />
                    <Select
                      aria-label="Length of the gap between payments"
                      value={form.intervalUnit}
                      options={INTERVAL_OPTIONS}
                      onChange={(event) => onChange('intervalUnit', event.target.value)}
                    />
                  </div>
                </FormField>

                <FormField
                  id="terms-deposit"
                  label="Deposit as a percentage"
                  hint="Taken before the schedule starts."
                  errors={fieldErrors.downPaymentPercentage}
                >
                  <Input
                    id="terms-deposit"
                    type="number"
                    min={0}
                    max={90}
                    step={0.01}
                    value={form.downPaymentPercentage}
                    onChange={(event) => onChange('downPaymentPercentage', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-interest" label="Interest as a percentage">
                  <Input
                    id="terms-interest"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.interestRatePercentage}
                    onChange={(event) => onChange('interestRatePercentage', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="terms-partner-fee"
                  label="Partner fee as a percentage"
                  hint="What a financing partner keeps from the settlement."
                >
                  <Input
                    id="terms-partner-fee"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.partnerFeePercentage}
                    onChange={(event) => onChange('partnerFeePercentage', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-late-fee" label={`Late fee in ${currency}`}>
                  <Input
                    id="terms-late-fee"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.lateFeeAmount}
                    onChange={(event) => onChange('lateFeeAmount', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-grace" label="Days of grace before a payment counts as late">
                  <Input
                    id="terms-grace"
                    type="number"
                    min={0}
                    max={60}
                    value={form.gracePeriodDays}
                    onChange={(event) => onChange('gracePeriodDays', event.target.value)}
                  />
                </FormField>

                <FormField id="terms-minimum" label={`Smallest invoice in ${currency}`}>
                  <Input
                    id="terms-minimum"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.minimumInvoiceAmount}
                    onChange={(event) => onChange('minimumInvoiceAmount', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="terms-maximum"
                  label={`Largest invoice in ${currency}`}
                  hint="Leave this empty for no ceiling."
                >
                  <Input
                    id="terms-maximum"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.maximumInvoiceAmount}
                    onChange={(event) => onChange('maximumInvoiceAmount', event.target.value)}
                  />
                </FormField>
              </div>

              <FormField id="terms-description" label="What the client is told">
                <Textarea
                  id="terms-description"
                  rows={3}
                  value={form.description}
                  placeholder="Pay a tenth today and the rest over six months."
                  onChange={(event) => onChange('description', event.target.value)}
                />
              </FormField>

              <Checkbox
                label="Each request has to be approved by hand"
                description="Useful while you are learning which clients keep to a schedule."
                checked={form.requiresApproval}
                onChange={(event) => onChange('requiresApproval', event.target.checked)}
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                  {editingId === null ? 'Save these terms' : 'Save the change'}
                </Button>
                {editingId === null ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    Leave them as they were
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
