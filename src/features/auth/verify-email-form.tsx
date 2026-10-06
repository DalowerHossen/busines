'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Input, Label } from '@/components/ui';
import { verifyEmailSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { submitAuthAction } from './form-utils';

type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export function VerifyEmailForm({
  token = '',
  onSubmit,
  onResend,
}: {
  readonly token?: string;
  readonly onSubmit?: AuthAction<VerifyEmailInput>;
  readonly onResend?: (email: string) => Promise<void>;
}): ReactNode {
  const [verificationToken, setVerificationToken] = useState(token);
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = verifyEmailSchema.safeParse({ token: verificationToken });
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Verification token is invalid.',
      });
      return;
    }
    setIsPending(true);
    const response = await submitAuthAction(onSubmit, parsed.data);
    setFeedback(response.feedback);
    setIsPending(false);
  };
  const resend = async () => {
    if (!onResend || !email) {
      setFeedback({
        type: 'error',
        message: 'Enter your email address to request another verification email.',
      });
      return;
    }
    setIsPending(true);
    try {
      await onResend(email);
      setFeedback({ type: 'success', message: 'A new verification email has been sent.' });
    } catch {
      setFeedback({ type: 'error', message: 'We could not send a new verification email.' });
    } finally {
      setIsPending(false);
    }
  };
  return (
    <div className="space-y-7">
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div>
          <Label htmlFor="verify-token" required>
            Verification token
          </Label>
          <Input
            id="verify-token"
            value={verificationToken}
            onChange={(event) => setVerificationToken(event.target.value)}
            autoComplete="one-time-code"
          />
        </div>
        <AuthFeedbackMessage feedback={feedback} />
        <Button type="submit" className="w-full" loading={isPending} loadingLabel="Verifying">
          Verify email
        </Button>
      </form>
      <div className="border-t border-border pt-6">
        <p className="text-sm font-semibold text-foreground">Need a new email?</p>
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="Email for verification resend"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void resend()}
            disabled={isPending}
          >
            Resend
          </Button>
        </div>
      </div>
      <Link
        href="/login"
        className="block text-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        Back to sign in
      </Link>
    </div>
  );
}
