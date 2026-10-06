// src/components/marketplace/vendor-application-form.tsx
// Asking to sell in the marketplace. The form collects what the shopfront
// will show about the vendor, and nothing about the money, because the
// platform sets those terms when it approves the application.

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
import { applyMarketplaceVendor } from '@/features/marketplace/actions/apply-vendor';

export interface VendorApplicationFormProps {
  /** Name of the business, used as the suggested vendor name. */
  defaultName: string;
  /** Email we already hold for the business. */
  defaultEmail: string;
}

/**
 * Turns a name into an address that fits the slug rules.
 *
 * @param value Name typed by the vendor.
 * @returns A slug built from it.
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Renders the vendor application.
 *
 * @param props Suggested values from the business profile.
 * @returns The rendered card.
 */
export function VendorApplicationForm({ defaultName, defaultEmail }: VendorApplicationFormProps) {
  const router = useRouter();
  const [vendorName, setVendorName] = useState(defaultName);
  const [vendorSlug, setVendorSlug] = useState(toSlug(defaultName));
  const [supportEmail, setSupportEmail] = useState(defaultEmail);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Sends the application.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);

    const result = await applyMarketplaceVendor({
      vendorName,
      vendorSlug,
      supportEmail,
      headline,
      bio,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Your application is with the platform team.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sell your templates</CardTitle>
        <CardDescription>
          Package an invoice layout, a chart of accounts or a set of reminder emails and sell it to
          other businesses. You keep the larger share of every sale.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {failure === null ? null : (
            <Alert tone="danger" title="That did not work">
              {failure}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="vendor-name" label="Vendor name" isRequired>
              <Input
                value={vendorName}
                onChange={(event) => {
                  setVendorName(event.target.value);
                  setVendorSlug(toSlug(event.target.value));
                }}
                required
                {...fieldAccessibilityProps('vendor-name', false, false)}
              />
            </FormField>

            <FormField
              id="vendor-slug"
              label="Shopfront address"
              hint="Lower case letters, numbers and hyphens."
              isRequired
            >
              <Input
                value={vendorSlug}
                onChange={(event) => setVendorSlug(event.target.value)}
                required
                {...fieldAccessibilityProps('vendor-slug', true, false)}
              />
            </FormField>
          </div>

          <FormField
            id="vendor-email"
            label="Support email address"
            hint="Buyers write here when a template needs help."
            isRequired
          >
            <Input
              type="email"
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              required
              {...fieldAccessibilityProps('vendor-email', true, false)}
            />
          </FormField>

          <FormField id="vendor-headline" label="One line about what you make">
            <Input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="Invoice layouts for construction firms"
              {...fieldAccessibilityProps('vendor-headline', false, false)}
            />
          </FormField>

          <FormField id="vendor-bio" label="About you">
            <Textarea
              value={bio}
              rows={4}
              onChange={(event) => setBio(event.target.value)}
              {...fieldAccessibilityProps('vendor-bio', false, false)}
            />
          </FormField>

          <Button type="submit" isLoading={isSaving} loadingLabel="Sending">
            Apply to sell
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
