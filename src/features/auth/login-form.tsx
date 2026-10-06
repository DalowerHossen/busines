'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Input, Label } from '@/components/ui';
import { signInSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { OAuthButtons } from './oauth-buttons';
import { submitAuthAction } from './form-utils';

type SignInInput = z.infer<typeof signInSchema>;

export function LoginForm({
  onSubmit,
  onOAuth,
  initialEmail = '',
}: {
  readonly onSubmit?: AuthAction<SignInInput>;
  readonly onOAuth?: (provider: 'google' | 'github') => Promise<void>;
  readonly initialEmail?: string;
}): ReactNode {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
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
    <div className="space-y-6">
      <OAuthButtons onOAuth={onOAuth} />
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div>
          <Label htmlFor="login-email" required>
            Email address
          </Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label htmlFor="login-password" required className="mb-0">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <AuthFeedbackMessage feedback={feedback} />
        <Button type="submit" className="w-full" loading={isPending} loadingLabel="Signing in">
          Sign in
        </Button>
      </form>
    </div>
  );
}
