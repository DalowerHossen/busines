// src/components/auth/sign-in-form.tsx
// The sign in form. It shows what went wrong without saying whether an
// address is registered, and sends the browser on once the session exists.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordField } from '@/components/auth/password-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/config/app';
import { signIn } from '@/features/auth/actions/sign-in';

export interface SignInFormProps {
  /** Page the visitor was trying to reach. */
  nextPath?: string | null;
  /** Reason the previous attempt failed, taken from the query string. */
  initialError?: string | null;
}

const PROVIDER_MESSAGES: Readonly<Record<string, string>> = {
  provider: 'That provider did not complete the sign in. Please try again.',
  missing_code: 'The sign in link was incomplete. Please try again.',
  exchange_failed: 'The sign in link has expired. Please try again.',
  provisioning_failed: 'Your login worked but the account could not be prepared. Please retry.',
};

/**
 * Renders the sign in form.
 *
 * @param props Where to continue to and any error carried in the address.
 * @returns The rendered form.
 */
export function SignInForm({ nextPath = null, initialError = null }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    initialError ? (PROVIDER_MESSAGES[initialError] ?? null) : null
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Signs in and continues to the page that was asked for.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await signIn({ email, password, rememberMe, nextPath });

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="space-y-5"
      >
        {formError ? (
          <Alert tone="danger" title="We could not sign you in">
            {formError}
          </Alert>
        ) : null}

        <FormField
          id="sign-in-email"
          label="Email address"
          isRequired
          errors={fieldErrors['email']}
        >
          <Input
            {...fieldAccessibilityProps('sign-in-email', false, Boolean(fieldErrors['email']))}
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

        <PasswordField
          id="sign-in-password"
          name="password"
          label="Password"
          value={password}
          disabled={isSubmitting}
          errors={fieldErrors['password']}
          onValueChange={setPassword}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox
            id="sign-in-remember"
            name="rememberMe"
            label="Keep me signed in"
            checked={rememberMe}
            disabled={isSubmitting}
            onChange={(event) => {
              setRememberMe(event.target.checked);
            }}
          />

          <Link
            href={ROUTES.forgotPassword}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgotten your password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel="Signing in">
          Sign in
        </Button>
      </form>

      <Separator label="or" />

      <OAuthButtons nextPath={nextPath} isDisabled={isSubmitting} />
    </div>
  );
}
