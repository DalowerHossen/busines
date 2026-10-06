// src/components/affiliate/application-form.tsx
// How somebody joins the referral programme. It asks for the little we need
// to pay a partner and to recognise their traffic, and nothing more.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { applyAffiliate } from '@/features/affiliates/actions/apply-affiliate';
import { clientEnv } from '@/lib/env/env.client';

export interface ApplicationFormProps {
  /** Address to use as the opening answer for contact. */
  defaultEmail: string;
  /** Name to use as the opening answer. */
  defaultName: string;
}

/**
 * Renders the application form.
 *
 * @param props Opening answers taken from the signed in account.
 * @returns The rendered card.
 */
export function ApplicationForm({ defaultEmail, defaultName }: ApplicationFormProps) {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState('');
  const [displayName, setDisplayName] = useState(defaultName);
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [promotionMethod, setPromotionMethod] = useState('');
  const [website, setWebsite] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Sends the application.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!hasAcceptedTerms) {
      setFailure('Accept the programme terms before applying.');
      return;
    }

    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await applyAffiliate({
      referralCode,
      displayName,
      contactEmail,
      promotionMethod,
      website,
      hasAcceptedTerms: true,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your application is with us.');
    router.refresh();
  }

  const preview = `${clientEnv.NEXT_PUBLIC_APP_URL}/r/${referralCode.length > 0 ? referralCode : 'your-code'}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join the referral programme</CardTitle>
        <CardDescription>
          Share a link, earn a share of what every business you send us pays, for as long as they
          stay. We review each application by hand, usually within two working days.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? (
            <Alert tone="danger" title="Your application was not sent">
              {failure}
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="affiliate-code"
              label="Referral code"
              hint={preview}
              errors={fieldErrors['referralCode'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'affiliate-code',
                  true,
                  (fieldErrors['referralCode'] ?? []).length > 0
                )}
                value={referralCode}
                maxLength={30}
                onChange={(event) => {
                  setReferralCode(event.target.value.toLowerCase());
                }}
              />
            </FormField>

            <FormField
              id="affiliate-name"
              label="Name to pay"
              errors={fieldErrors['displayName'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'affiliate-name',
                  false,
                  (fieldErrors['displayName'] ?? []).length > 0
                )}
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="affiliate-email"
              label="Contact email"
              errors={fieldErrors['contactEmail'] ?? []}
              isRequired
            >
              <Input
                {...fieldAccessibilityProps(
                  'affiliate-email',
                  false,
                  (fieldErrors['contactEmail'] ?? []).length > 0
                )}
                type="email"
                value={contactEmail}
                onChange={(event) => {
                  setContactEmail(event.target.value);
                }}
              />
            </FormField>

            <FormField id="affiliate-website" label="Website or profile">
              <Input
                {...fieldAccessibilityProps('affiliate-website', false, false)}
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value);
                }}
              />
            </FormField>
          </div>

          <FormField
            id="affiliate-method"
            label="How you plan to promote us"
            hint="A newsletter, a client base, a course, a review site. Plain words are fine."
          >
            <Textarea
              {...fieldAccessibilityProps('affiliate-method', true, false)}
              rows={3}
              value={promotionMethod}
              onChange={(event) => {
                setPromotionMethod(event.target.value);
              }}
            />
          </FormField>

          <Checkbox
            label="I accept the referral programme terms"
            description="No paid search on our brand name, no incentivised signups, and no self referral."
            checked={hasAcceptedTerms}
            onChange={(event) => {
              setHasAcceptedTerms(event.target.checked);
            }}
          />

          <Button type="submit" isLoading={isSaving} loadingLabel="Sending">
            Apply to join
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
