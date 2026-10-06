// src/components/admin/coupon-manager.tsx
// The discount codes the platform hands out: what each one gives, how often
// it has been claimed, and the form to create another.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { saveCoupon } from '@/features/admin/actions/save-coupon';
import { setCouponState } from '@/features/admin/actions/set-coupon-state';
import type { AdminCoupon } from '@/features/admin/queries/list-plans';
import { formatDate } from '@/lib/dates';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';
import { COUPON_TYPES, type CouponType } from '@/types/enums';

export interface CouponManagerProps {
  /** Codes already created. */
  coupons: readonly AdminCoupon[];
}

const TYPE_OPTIONS: readonly SelectOption[] = COUPON_TYPES.map((type) => ({
  value: type,
  label: humanise(type),
}));

/**
 * Renders the discount codes and the form to add one.
 *
 * @param props The codes to show.
 * @returns The rendered section.
 */
export function CouponManager({ coupons }: CouponManagerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [couponType, setCouponType] = useState<CouponType>('percentage');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [durationMonths, setDurationMonths] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Creates one discount code.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveCoupon({
      code,
      name,
      couponType,
      value,
      ...(couponType === 'fixed_amount' ? { currency } : {}),
      ...(durationMonths.length > 0 ? { durationMonths } : {}),
      ...(maxRedemptions.length > 0 ? { maxRedemptions } : {}),
      maxRedemptionsPerAccount: 1,
      validUntil,
      campaignName,
      isActive: true,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('The code can be used straight away.');
    setIsOpen(false);
    setCode('');
    setName('');
    setValue('');
    router.refresh();
  }

  /**
   * Switches one code on or off.
   *
   * @param coupon Code being switched.
   * @returns Nothing.
   */
  async function toggle(coupon: AdminCoupon): Promise<void> {
    setBusyId(coupon.id);
    setFailure(null);

    const result = await setCouponState({ couponId: coupon.id, isActive: !coupon.isActive });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(coupon.isActive ? 'That code is switched off.' : 'That code is live again.');
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Discount codes</h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          New code
        </Button>
      </div>

      {failure ? (
        <Alert tone="danger" title="That code was not saved">
          {failure}
        </Alert>
      ) : null}

      {coupons.length === 0 ? (
        <EmptyState
          title="No discount code exists yet"
          description="Create one for a campaign, a partner, or to make good on a support promise."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Gives</TableHead>
                <TableHead isNumeric>Claimed</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>State</TableHead>
                <TableHead>
                  <span className="visually-hidden">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{coupon.code}</span>
                    <span className="block text-sm text-muted-foreground">{coupon.name}</span>
                  </TableCell>
                  <TableCell>
                    {coupon.couponType === 'percentage'
                      ? `${Number.parseFloat(coupon.value).toFixed(2)}% off`
                      : coupon.couponType === 'fixed_amount'
                        ? `${coupon.value} ${coupon.currency ?? ''} off`
                        : `${Number.parseFloat(coupon.value)} extra trial days`}
                  </TableCell>
                  <TableCell isNumeric>
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions === null ? '' : ` of ${coupon.maxRedemptions}`}
                  </TableCell>
                  <TableCell>
                    {coupon.validUntil ? formatDate(coupon.validUntil) : 'No end date'}
                  </TableCell>
                  <TableCell>
                    <Badge tone={coupon.isActive ? 'success' : 'neutral'}>
                      {coupon.isActive ? 'Live' : 'Off'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isLoading={busyId === coupon.id}
                        loadingLabel="Saving"
                        onClick={() => {
                          void toggle(coupon);
                        }}
                      >
                        {coupon.isActive ? 'Switch off' : 'Switch on'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        title="New discount code"
        description="A code can be claimed once per business by default, which is what stops a public code being farmed."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="coupon-code-new"
              label="Code"
              errors={fieldErrors['code'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'coupon-code-new',
                  false,
                  (fieldErrors['code'] ?? []).length > 0
                )}
                value={code}
                spellCheck={false}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                }}
              />
            </FormField>

            <FormField id="coupon-name" label="Name" errors={fieldErrors['name'] ?? []} isRequired>
              <Input
                {...fieldAccessibilityProps(
                  'coupon-name',
                  false,
                  (fieldErrors['name'] ?? []).length > 0
                )}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </FormField>

            <FormField id="coupon-type" label="Type" isRequired>
              <Select
                {...fieldAccessibilityProps('coupon-type', false, false)}
                options={TYPE_OPTIONS}
                value={couponType}
                onChange={(event) => {
                  setCouponType(event.target.value as CouponType);
                }}
              />
            </FormField>

            <FormField
              id="coupon-value"
              label="Value"
              hint="A percentage, an amount, or a number of extra trial days."
              errors={fieldErrors['value'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'coupon-value',
                  true,
                  (fieldErrors['value'] ?? []).length > 0
                )}
                type="number"
                step="0.01"
                min={0}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
              />
            </FormField>

            {couponType === 'fixed_amount' ? (
              <FormField
                id="coupon-currency"
                label="Currency"
                errors={fieldErrors['currency'] ?? []}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps(
                    'coupon-currency',
                    false,
                    (fieldErrors['currency'] ?? []).length > 0
                  )}
                  value={currency}
                  maxLength={3}
                  onChange={(event) => {
                    setCurrency(event.target.value.toUpperCase());
                  }}
                />
              </FormField>
            ) : null}

            <FormField
              id="coupon-duration"
              label="Months the discount lasts"
              hint="Leave empty to apply it to one charge only."
              errors={fieldErrors['durationMonths'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('coupon-duration', true, false)}
                type="number"
                min={1}
                max={120}
                value={durationMonths}
                onChange={(event) => {
                  setDurationMonths(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="coupon-max"
              label="Total claims allowed"
              hint="Leave empty for no overall limit."
              errors={fieldErrors['maxRedemptions'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('coupon-max', true, false)}
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(event) => {
                  setMaxRedemptions(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="coupon-until"
              label="Valid until"
              errors={fieldErrors['validUntil'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('coupon-until', false, false)}
                type="date"
                value={validUntil}
                onChange={(event) => {
                  setValidUntil(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="coupon-campaign"
              label="Campaign"
              errors={fieldErrors['campaignName'] ?? []}
            >
              <Input
                {...fieldAccessibilityProps('coupon-campaign', false, false)}
                value={campaignName}
                onChange={(event) => {
                  setCampaignName(event.target.value);
                }}
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving} loadingLabel="Creating">
              Create code
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
