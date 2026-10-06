// src/components/admin/plan-price-editor.tsx
// Setting what one plan costs for one interval in one currency, so the same
// plan can be sold monthly, yearly and in several currencies.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { savePlanPrice } from '@/features/admin/actions/save-plan-price';
import type { AdminPlan } from '@/features/admin/queries/list-plans';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';
import { BILLING_INTERVALS, type BillingInterval } from '@/types/enums';

export interface PlanPriceEditorProps {
  /** Plan the price belongs to. */
  plan: AdminPlan;
  /** True while the dialog is shown. */
  isOpen: boolean;
  /** Called when the dialog asks to be closed. */
  onClose: () => void;
}

const INTERVAL_OPTIONS: readonly SelectOption[] = BILLING_INTERVALS.map((interval) => ({
  value: interval,
  label: humanise(interval),
}));

/**
 * Renders the price form.
 *
 * @param props The plan and the dialog state.
 * @returns The rendered dialog.
 */
export function PlanPriceEditor({ plan, isOpen, onClose }: PlanPriceEditorProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('0');
  const [compareAtAmount, setCompareAtAmount] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const existing = plan.prices.find(
    (price) => price.interval === interval && price.currency === currency
  );

  /**
   * Writes the price.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await savePlanPrice({
      planId: plan.id,
      ...(existing ? { priceId: existing.id } : {}),
      interval,
      currency,
      amount,
      ...(compareAtAmount.length > 0 ? { compareAtAmount } : {}),
      isActive,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('The price is live for anyone choosing this plan now.');
    onClose();
    router.refresh();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Price for ${plan.name}`}
      description="A plan carries one price per interval and currency. Changing a price never alters what an existing subscriber already pays."
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failure ? (
          <Alert tone="danger" title="That price was not saved">
            {failure}
          </Alert>
        ) : null}

        {existing ? (
          <Alert tone="info" title="This combination already has a price">
            Saving replaces the current {existing.amount} {existing.currency}.
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="price-interval" label="Interval" isRequired>
            <Select
              {...fieldAccessibilityProps('price-interval', false, false)}
              options={INTERVAL_OPTIONS}
              value={interval}
              onChange={(event) => {
                setInterval(event.target.value as BillingInterval);
              }}
            />
          </FormField>

          <FormField
            id="price-currency"
            label="Currency"
            errors={fieldErrors['currency'] ?? []}
            isRequired
          >
            <Input
              {...fieldAccessibilityProps(
                'price-currency',
                false,
                (fieldErrors['currency'] ?? []).length > 0
              )}
              value={currency}
              maxLength={3}
              spellCheck={false}
              onChange={(event) => {
                setCurrency(event.target.value.toUpperCase());
              }}
            />
          </FormField>

          <FormField
            id="price-amount"
            label="Amount"
            errors={fieldErrors['amount'] ?? []}
            isRequired
          >
            <Input
              {...fieldAccessibilityProps(
                'price-amount',
                false,
                (fieldErrors['amount'] ?? []).length > 0
              )}
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="price-compare"
            label="Struck through price"
            hint="Shown crossed out on the pricing page. Leave empty for none."
            errors={fieldErrors['compareAtAmount'] ?? []}
          >
            <Input
              {...fieldAccessibilityProps('price-compare', true, false)}
              type="number"
              step="0.01"
              min={0}
              value={compareAtAmount}
              onChange={(event) => {
                setCompareAtAmount(event.target.value);
              }}
            />
          </FormField>
        </div>

        <Checkbox
          id="price-active"
          label="On sale"
          description="Switch off to retire a price without touching anyone already paying it."
          checked={isActive}
          onChange={(event) => {
            setIsActive(event.target.checked);
          }}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
            Save price
          </Button>
        </div>
      </form>
    </Modal>
  );
}
