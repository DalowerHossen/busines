// src/components/auth/verify-email-panel.tsx
// What a new account sees until the address on it has been confirmed, with a
// way to send the message again.

'use client';

import { MailCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';
import { resendVerification } from '@/features/auth/actions/resend-verification';

export interface VerifyEmailPanelProps {
  /** Address the account was opened with, when it is known. */
  email?: string | null;
}

/**
 * Renders the confirmation panel.
 *
 * @param props Address the confirmation was sent to.
 * @returns The rendered panel.
 */
export function VerifyEmailPanel({ email = null }: VerifyEmailPanelProps) {
  const [address, setAddress] = useState(email ?? '');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Sends the confirmation message again.
   *
   * @returns Nothing.
   */
  async function resend(): Promise<void> {
    setIsSending(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    const result = await resendVerification({ email: address });

    setIsSending(false);

    if (!result.success) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setMessage(result.data.message);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <MailCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Confirm your email address</h2>
          <p className="text-sm text-muted-foreground">
            {email
              ? `We have sent a confirmation link to ${email}. Open it and your account is ready.`
              : 'We have sent you a confirmation link. Open it and your account is ready.'}
          </p>
        </div>
      </div>

      {message ? (
        <Alert tone="success" title="Message sent">
          {message}
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="The message was not sent">
          {error}
        </Alert>
      ) : null}

      <FormField
        id="verify-email-address"
        label="Email address"
        hint="Change it here if you typed it wrongly, then send the message again."
        errors={fieldErrors['email']}
      >
        <Input
          {...fieldAccessibilityProps('verify-email-address', true, Boolean(fieldErrors['email']))}
          name="email"
          type="email"
          autoComplete="email"
          value={address}
          disabled={isSending}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
        />
      </FormField>

      <Button
        type="button"
        fullWidth
        isLoading={isSending}
        loadingLabel="Sending"
        leadingIcon={<RefreshCw className="h-4 w-4" />}
        onClick={() => {
          void resend();
        }}
      >
        Send the link again
      </Button>

      <p className="text-sm text-muted-foreground">
        Nothing arrived? Look in the spam folder, or write to{' '}
        <a
          href={`mailto:${BRAND.supportEmail}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {BRAND.supportEmail}
        </a>
        . You can also{' '}
        <Link href={ROUTES.login} className="text-primary underline-offset-4 hover:underline">
          sign in again
        </Link>
        .
      </p>
    </div>
  );
}
