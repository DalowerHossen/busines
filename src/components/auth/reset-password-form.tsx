// src/components/auth/reset-password-form.tsx
// Choosing a new password after following the link from the reset message.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { PasswordField } from '@/components/auth/password-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toaster';
import { resetPassword } from '@/features/auth/actions/reset-password';

/**
 * Renders the new password form.
 *
 * @returns The rendered form.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the new password and continues into the dashboard.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await resetPassword({ password, confirmPassword });

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your password has been changed', 'You are signed in with the new password.');
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
        <Alert tone="danger" title="The password was not changed">
          {formError}
        </Alert>
      ) : null}

      <PasswordField
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        hint="At least twelve characters, with an uppercase letter and a digit."
        showStrength
        value={password}
        disabled={isSubmitting}
        errors={fieldErrors['password']}
        onValueChange={setPassword}
      />

      <PasswordField
        id="reset-password-confirm"
        name="confirmPassword"
        label="Type it again"
        autoComplete="new-password"
        value={confirmPassword}
        disabled={isSubmitting}
        errors={fieldErrors['confirmPassword']}
        onValueChange={setConfirmPassword}
      />

      <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel="Saving">
        Save the new password
      </Button>
    </form>
  );
}
