'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Input, Label } from '@/components/ui';
import { resetPasswordSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { submitAuthAction } from './form-utils';

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({
  token,
  onSubmit,
}: {
  readonly token: string;
  readonly onSubmit?: AuthAction<ResetPasswordInput>;
}): ReactNode {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
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
        <Label htmlFor="reset-password" required>
          New password
        </Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="reset-confirm" required>
          Confirm new password
        </Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      <AuthFeedbackMessage feedback={feedback} />
      <Button type="submit" className="w-full" loading={isPending} loadingLabel="Saving password">
        Save new password
      </Button>
      {feedback?.type === 'success' ? (
        <Link
          href="/login"
          className="block text-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Continue to sign in
        </Link>
      ) : null}
    </form>
  );
}
