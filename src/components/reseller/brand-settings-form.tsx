// src/components/reseller/brand-settings-form.tsx
// How a partner's brand appears to the accounts it sells to: the name, the
// colours, the logo and the address the product is served from.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { updateResellerBrand } from '@/features/resellers/actions/update-reseller-brand';
import type { ResellerProfile } from '@/features/resellers/types';
import { formatDate } from '@/lib/dates';

export interface BrandSettingsFormProps {
  /** The partner record being edited. */
  profile: ResellerProfile;
}

/**
 * Renders the brand settings.
 *
 * @param props The partner record.
 * @returns The rendered card.
 */
export function BrandSettingsForm({ profile }: BrandSettingsFormProps) {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState(profile.partnerName);
  const [contactEmail, setContactEmail] = useState(profile.contactEmail);
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? '');
  const [brandName, setBrandName] = useState(profile.brandName ?? '');
  const [brandLogoUrl, setBrandLogoUrl] = useState(profile.brandLogoUrl ?? '');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(
    profile.brandPrimaryColor ?? '#1d4ed8'
  );
  const [brandAccentColor, setBrandAccentColor] = useState(profile.brandAccentColor ?? '#0f172a');
  const [customDomain, setCustomDomain] = useState(profile.customDomain ?? '');
  const [hidePlatformBranding, setHidePlatformBranding] = useState(profile.hidePlatformBranding);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the presentation.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await updateResellerBrand({
      partnerName,
      contactEmail,
      contactPhone,
      brandName,
      brandLogoUrl,
      brandPrimaryColor,
      brandAccentColor,
      customDomain,
      hidePlatformBranding,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Your brand settings are saved.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your brand</CardTitle>
          <CardDescription>
            This is what the businesses you sell to see. Changes reach them within a few minutes.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {failure ? (
              <Alert tone="danger" title="Those settings were not saved">
                {failure}
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                id="brand-partner-name"
                label="Your business name"
                errors={fieldErrors['partnerName'] ?? []}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps(
                    'brand-partner-name',
                    false,
                    (fieldErrors['partnerName'] ?? []).length > 0
                  )}
                  value={partnerName}
                  onChange={(event) => {
                    setPartnerName(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="brand-name"
                label="Brand shown to clients"
                errors={fieldErrors['brandName'] ?? []}
              >
                <Input
                  {...fieldAccessibilityProps('brand-name', false, false)}
                  value={brandName}
                  onChange={(event) => {
                    setBrandName(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="brand-email"
                label="Contact email"
                errors={fieldErrors['contactEmail'] ?? []}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps(
                    'brand-email',
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

              <FormField id="brand-phone" label="Telephone">
                <Input
                  {...fieldAccessibilityProps('brand-phone', false, false)}
                  value={contactPhone}
                  onChange={(event) => {
                    setContactPhone(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="brand-logo"
                label="Logo address"
                hint="A direct link to a PNG or SVG, at least 240 pixels wide."
                errors={fieldErrors['brandLogoUrl'] ?? []}
              >
                <Input
                  {...fieldAccessibilityProps('brand-logo', true, false)}
                  value={brandLogoUrl}
                  onChange={(event) => {
                    setBrandLogoUrl(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="brand-domain"
                label="Your own domain"
                hint="Point a CNAME at our platform first; we verify it before it goes live."
                errors={fieldErrors['customDomain'] ?? []}
              >
                <Input
                  {...fieldAccessibilityProps('brand-domain', true, false)}
                  value={customDomain}
                  onChange={(event) => {
                    setCustomDomain(event.target.value.toLowerCase());
                  }}
                />
              </FormField>

              <FormField
                id="brand-primary"
                label="Primary colour"
                errors={fieldErrors['brandPrimaryColor'] ?? []}
              >
                <Input
                  {...fieldAccessibilityProps('brand-primary', false, false)}
                  value={brandPrimaryColor}
                  onChange={(event) => {
                    setBrandPrimaryColor(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="brand-accent"
                label="Accent colour"
                errors={fieldErrors['brandAccentColor'] ?? []}
              >
                <Input
                  {...fieldAccessibilityProps('brand-accent', false, false)}
                  value={brandAccentColor}
                  onChange={(event) => {
                    setBrandAccentColor(event.target.value);
                  }}
                />
              </FormField>
            </div>

            <Checkbox
              label="Hide the platform badge"
              description="Removes our name from the portals and documents your clients see."
              checked={hidePlatformBranding}
              onChange={(event) => {
                setHidePlatformBranding(event.target.checked);
              }}
            />

            <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
              Save brand settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your agreement</CardTitle>
          <CardDescription>
            Set by us when your application was approved. Write to support to revisit them.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Partner address</dt>
              <dd className="text-foreground">{profile.slug}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Revenue share</dt>
              <dd className="tabular text-foreground">{profile.revenueSharePercentage}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accounts allowed</dt>
              <dd className="text-foreground">
                {profile.maxSubTenants === null
                  ? 'No limit'
                  : `${profile.subTenantCount} of ${profile.maxSubTenants} used`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Billing currency</dt>
              <dd className="text-foreground">{profile.billingCurrency}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Domain verified</dt>
              <dd className="text-foreground">
                {profile.customDomainVerifiedAt === null
                  ? 'Not verified yet'
                  : formatDate(profile.customDomainVerifiedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
