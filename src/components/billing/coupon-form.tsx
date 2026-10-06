// src/components/billing/coupon-form.tsx
// Claiming a discount code against the plan this business is on.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { redeemCoupon } from '@/features/billing/actions/redeem-coupon';

export interface CouponFormProps {
  /** False when the signed in account may not change the plan. */
  canRedeem: boolean;
}

/**
 * Renders the discount code form.
 *
 * @param props Whether the viewer may claim a code.
 * @returns The rendered form.
 */
export function CouponForm({ canRedeem }: CouponFormProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<readonly string[]>([]);

  if (!canRedeem) {
    return null;
  }

  /**
   * Sends the code to the server.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors([]);

    const result = await redeemCoupon({ code });
    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors?.code ?? []);
      return;
    }

    notify.success('The code was applied to your next charge.');
    setCode('');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {failure ? (
        <Alert tone="danger" title="That code was not applied">
          {failure}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField id="coupon-code" label="Discount code" errors={fieldErrors}>
            <Input
              {...fieldAccessibilityProps('coupon-code', false, fieldErrors.length > 0)}
              value={code}
              autoComplete="off"
              spellCheck={false}
              placeholder="SPRING25"
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
              }}
            />
          </FormField>
        </div>

        <Button type="submit" variant="secondary" isLoading={isSaving} loadingLabel="Checking">
          Apply code
        </Button>
      </div>
    </form>
  );
}
