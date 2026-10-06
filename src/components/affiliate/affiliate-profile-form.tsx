// src/components/affiliate/affiliate-profile-form.tsx
// The details a partner owns: who we pay, where to write and how they
// promote us. The commission rate and the programme terms sit here as plain
// figures, because a partner should always be able to read their own deal.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { updateAffiliateProfile } from '@/features/affiliates/actions/update-affiliate-profile';
import type { AffiliateProfile } from '@/features/affiliates/types';
import { formatMoney } from '@/lib/format';

export interface AffiliateProfileFormProps {
  /** The partner record being edited. */
  profile: AffiliateProfile;
}

/**
 * Renders the partner details form.
 *
 * @param props The partner record.
 * @returns The rendered card.
 */
export function AffiliateProfileForm({ profile }: AffiliateProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [contactEmail, setContactEmail] = useState(profile.contactEmail);
  const [website, setWebsite] = useState(profile.website ?? '');
  const [promotionMethod, setPromotionMethod] = useState(profile.promotionMethod ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the details.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await updateAffiliateProfile({
      displayName,
      contactEmail,
      website,
      promotionMethod,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your details are saved.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Where we write to you, and who the payment is made out to.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {failure ? (
              <Alert tone="danger" title="Those details were not saved">
                {failure}
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                id="profile-name"
                label="Name to pay"
                errors={fieldErrors['displayName'] ?? []}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps(
                    'profile-name',
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
                id="profile-email"
                label="Contact email"
                errors={fieldErrors['contactEmail'] ?? []}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps(
                    'profile-email',
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

              <FormField id="profile-website" label="Website or profile">
                <Input
                  {...fieldAccessibilityProps('profile-website', false, false)}
                  value={website}
                  onChange={(event) => {
                    setWebsite(event.target.value);
                  }}
                />
              </FormField>
            </div>

            <FormField id="profile-method" label="How you promote us">
              <Textarea
                {...fieldAccessibilityProps('profile-method', false, false)}
                rows={3}
                value={promotionMethod}
                onChange={(event) => {
                  setPromotionMethod(event.target.value);
                }}
              />
            </FormField>

            <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
              Save details
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your terms</CardTitle>
          <CardDescription>
            These are set by us. Write to support if you think your volume has earned a better rate.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Your referral code</dt>
              <dd className="text-foreground">{profile.referralCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Commission</dt>
              <dd className="tabular text-foreground">{profile.commissionPercentage}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Earning period</dt>
              <dd className="text-foreground">
                {profile.commissionDurationMonths === null
                  ? 'For as long as the business stays'
                  : `${profile.commissionDurationMonths} months per business`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Attribution window</dt>
              <dd className="text-foreground">{profile.cookieWindowDays} days from the visit</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Minimum payout</dt>
              <dd className="tabular text-foreground">
                {formatMoney(profile.minimumPayoutAmount, profile.payoutCurrency)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
