// src/components/auth/sign-up-form.tsx
// Opening an account: name, business, address and password in one step, with
// the plan carried through from the pricing page.

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
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/config/app';
import { COUNTRIES } from '@/config/countries';
import { signUp } from '@/features/auth/actions/sign-up';

export interface SignUpFormProps {
  /** Plan chosen on the pricing page, when there was one. */
  planKey?: string;
}

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
}));

/**
 * Renders the sign up form.
 *
 * @param props The plan the visitor arrived with.
 * @returns The rendered form.
 */
export function SignUpForm({ planKey = 'free' }: SignUpFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Creates the account and moves on to the confirmation page.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await signUp({
      fullName,
      companyName,
      email,
      password,
      countryCode,
      planKey,
      acceptsTerms,
      marketingOptIn,
      website,
    });

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    router.replace(`${result.data.redirectTo}?email=${encodeURIComponent(result.data.email)}`);
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
          <Alert tone="danger" title="The account was not created">
            {formError}
          </Alert>
        ) : null}

        <FormField id="sign-up-name" label="Your name" isRequired errors={fieldErrors['fullName']}>
          <Input
            {...fieldAccessibilityProps('sign-up-name', false, Boolean(fieldErrors['fullName']))}
            name="fullName"
            autoComplete="name"
            autoFocus
            value={fullName}
            disabled={isSubmitting}
            onChange={(event) => {
              setFullName(event.target.value);
            }}
          />
        </FormField>

        <FormField
          id="sign-up-company"
          label="Business name"
          isRequired
          hint="This is what your clients will see on an invoice. You can change it later."
          errors={fieldErrors['companyName']}
        >
          <Input
            {...fieldAccessibilityProps(
              'sign-up-company',
              true,
              Boolean(fieldErrors['companyName'])
            )}
            name="companyName"
            autoComplete="organization"
            value={companyName}
            disabled={isSubmitting}
            onChange={(event) => {
              setCompanyName(event.target.value);
            }}
          />
        </FormField>

        <FormField id="sign-up-email" label="Work email" isRequired errors={fieldErrors['email']}>
          <Input
            {...fieldAccessibilityProps('sign-up-email', false, Boolean(fieldErrors['email']))}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            disabled={isSubmitting}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </FormField>

        <FormField
          id="sign-up-country"
          label="Country"
          isRequired
          errors={fieldErrors['countryCode']}
        >
          <Select
            {...fieldAccessibilityProps(
              'sign-up-country',
              false,
              Boolean(fieldErrors['countryCode'])
            )}
            name="countryCode"
            options={COUNTRY_OPTIONS}
            value={countryCode}
            disabled={isSubmitting}
            isInvalid={Boolean(fieldErrors['countryCode'])}
            onChange={(event) => {
              setCountryCode(event.target.value);
            }}
          />
        </FormField>

        <PasswordField
          id="sign-up-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          hint="At least twelve characters, with an uppercase letter and a digit."
          showStrength
          value={password}
          disabled={isSubmitting}
          errors={fieldErrors['password']}
          onValueChange={setPassword}
        />

        <div aria-hidden="true" className="visually-hidden">
          <label htmlFor="sign-up-website">Leave this field empty</label>
          <input
            id="sign-up-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => {
              setWebsite(event.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Checkbox
            id="sign-up-terms"
            name="acceptsTerms"
            checked={acceptsTerms}
            disabled={isSubmitting}
            onChange={(event) => {
              setAcceptsTerms(event.target.checked);
            }}
            label={
              <span>
                I agree to the{' '}
                <Link
                  href={ROUTES.termsOfService}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  terms of service
                </Link>{' '}
                and the{' '}
                <Link
                  href={ROUTES.privacyPolicy}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  privacy policy
                </Link>
                .
              </span>
            }
          />
          {fieldErrors['acceptsTerms'] ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {fieldErrors['acceptsTerms'].join(' ')}
            </p>
          ) : null}

          <Checkbox
            id="sign-up-marketing"
            name="marketingOptIn"
            checked={marketingOptIn}
            disabled={isSubmitting}
            label="Send me occasional product news. No more than once a month."
            onChange={(event) => {
              setMarketingOptIn(event.target.checked);
            }}
          />
        </div>

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          loadingLabel="Creating your account"
        >
          Create my account
        </Button>

        <p className="text-xs text-muted-foreground">
          No card is needed. Your account starts on the free plan and you can change it whenever you
          like.
        </p>
      </form>

      <Separator label="or" />

      <OAuthButtons isDisabled={isSubmitting} />
    </div>
  );
}
