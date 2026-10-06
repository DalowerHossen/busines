'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Input, Label } from '@/components/ui';
import { twoFactorCodeSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { submitAuthAction } from './form-utils';

type TwoFactorInput = z.infer<typeof twoFactorCodeSchema>;

export function TwoFactorForm({
  onSubmit,
  recovery = false,
}: {
  readonly onSubmit?: AuthAction<TwoFactorInput>;
  readonly recovery?: boolean;
}): ReactNode {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = twoFactorCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Enter the six-digit verification code.',
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
        <Label htmlFor="two-factor-code" required>
          {recovery ? 'Recovery code' : 'Authenticator code'}
        </Label>
        <Input
          id="two-factor-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/gu, '').slice(0, 6))}
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.35em]"
        />
      </div>
      <AuthFeedbackMessage feedback={feedback} />
      <Button type="submit" className="w-full" loading={isPending} loadingLabel="Checking code">
        Continue
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        Use a different sign-in method
      </Link>
    </form>
  );
}
