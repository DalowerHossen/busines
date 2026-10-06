// src/components/auth/two-factor-form.tsx
// The second step of signing in: a code from the authenticator application,
// or a recovery code when the phone is not to hand.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { verifyTwoFactor } from '@/features/auth/actions/verify-two-factor';

export interface TwoFactorFormProps {
  /** Page the visitor was trying to reach. */
  nextPath?: string | null;
}

/**
 * Renders the two step verification form.
 *
 * @param props Where to continue to once the code is accepted.
 * @returns The rendered form.
 */
export function TwoFactorForm({ nextPath = null }: TwoFactorFormProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Checks the code and continues.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await verifyTwoFactor({ code, nextPath });

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    if (result.data.usedRecoveryCode) {
      notify.warning(
        'A recovery code was used',
        `${result.data.recoveryCodesRemaining} recovery codes are left. Generate a new set in settings.`
      );
    }

    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5"
    >
      {formError ? (
        <Alert tone="danger" title="That code was not accepted">
          {formError}
        </Alert>
      ) : null}

      <FormField
        id="two-factor-code"
        label={useRecoveryCode ? 'Recovery code' : 'Six digit code'}
        isRequired
        hint={
          useRecoveryCode
            ? 'Type one of the codes you saved when two step verification was switched on.'
            : 'Open your authenticator application and type the code it shows.'
        }
        errors={fieldErrors['code']}
      >
        <Input
          {...fieldAccessibilityProps('two-factor-code', true, Boolean(fieldErrors['code']))}
          name="code"
          autoFocus
          inputMode={useRecoveryCode ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          className="tabular tracking-widest"
          value={code}
          disabled={isSubmitting}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
      </FormField>

      <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel="Checking">
        Verify and continue
      </Button>

      <Button
        type="button"
        variant="ghost"
        fullWidth
        disabled={isSubmitting}
        onClick={() => {
          setUseRecoveryCode((current) => !current);
          setCode('');
        }}
      >
        {useRecoveryCode ? 'Use the authenticator code instead' : 'Use a recovery code instead'}
      </Button>
    </form>
  );
}
