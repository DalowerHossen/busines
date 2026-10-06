'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button, Checkbox, Input, Label } from '@/components/ui';
import { signUpSchema } from '@/lib/validators';
import type { AuthAction, AuthFeedback } from './auth-types';
import { AuthFeedbackMessage } from './auth-feedback';
import { submitAuthAction } from './form-utils';

type SignUpInput = z.infer<typeof signUpSchema>;

export function SignupForm({
  onSubmit,
}: {
  readonly onSubmit?: AuthAction<SignUpInput>;
}): ReactNode {
  const [values, setValues] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    termsVersion: '2026-10-06',
    termsAccepted: false,
  });
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const update = (key: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(values);
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
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="signup-name" required>
            Full name
          </Label>
          <Input
            id="signup-name"
            autoComplete="name"
            value={values.fullName}
            onChange={(event) => update('fullName', event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="signup-company" required>
            Company name
          </Label>
          <Input
            id="signup-company"
            autoComplete="organization"
            value={values.companyName}
            onChange={(event) => update('companyName', event.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="signup-email" required>
          Email address
        </Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="signup-password" required>
          Password
        </Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use 12 or more characters with upper, lower, and numeric characters.
        </p>
      </div>
      <div>
        <Label htmlFor="signup-confirm" required>
          Confirm password
        </Label>
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={values.termsAccepted}
          onChange={(event) => update('termsAccepted', event.target.checked)}
        />
        <span>
          I agree to the{' '}
          <Link
            href="/terms"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            terms
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            privacy policy
          </Link>
          .
        </span>
      </label>
      <AuthFeedbackMessage feedback={feedback} />
      <Button type="submit" className="w-full" loading={isPending} loadingLabel="Creating account">
        Create account
      </Button>
    </form>
  );
}
