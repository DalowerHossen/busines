// src/components/auth/forgot-password-form.tsx
// Asking for a reset link. The confirmation is deliberately the same whether
// or not the address has an account.

'use client';

import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/features/auth/actions/request-password-reset';

/**
 * Renders the forgotten password form.
 *
 * @returns The rendered form.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Requests the reset message.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await requestPasswordReset({ email });

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setSentMessage(result.data.message);
  }

  if (sentMessage) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <MailCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">{sentMessage}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={() => {
            setSentMessage(null);
          }}
        >
          Use a different address
        </Button>
      </div>
    );
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
        <Alert tone="danger" title="That did not work">
          {formError}
        </Alert>
      ) : null}

      <FormField
        id="forgot-email"
        label="Email address"
        isRequired
        hint="We send the link to the address on the account."
        errors={fieldErrors['email']}
      >
        <Input
          {...fieldAccessibilityProps('forgot-email', true, Boolean(fieldErrors['email']))}
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          disabled={isSubmitting}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </FormField>

      <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel="Sending the link">
        Send the reset link
      </Button>
    </form>
  );
}
