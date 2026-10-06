'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Input, Label } from '@/components/ui';
import { requestPasswordResetSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { submitAuthAction } from './form-utils';

type RequestResetInput = z.infer<typeof requestPasswordResetSchema>;

export function ForgotPasswordForm({
  onSubmit,
}: {
  readonly onSubmit?: AuthAction<RequestResetInput>;
}): ReactNode {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = requestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Enter a valid email address.',
      });
      return;
    }
    setIsPending(true);
    const response = await submitAuthAction(onSubmit, parsed.data);
    setFeedback(response.feedback);
    setIsPending(false);
  };
  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <div>
        <Label htmlFor="forgot-email" required>
          Email address
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <AuthFeedbackMessage feedback={feedback} />
      <Button type="submit" className="w-full" loading={isPending} loadingLabel="Sending link">
        Send reset link
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        Back to sign in
      </Link>
    </form>
  );
}
