// src/components/admin/measurement-console.tsx
// Where the measurement of this website is configured.
//
// Marketing people should not need a developer to add a property, and a
// developer should not have to paste a snippet into a layout file. An
// identifier typed here loads on the next page view. Each destination names
// the consent category it belongs to, and the loader honours that: a visitor
// who refused marketing cookies never meets an advertising pixel.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import {
  removeMeasurementDestination,
  saveMeasurementDestination,
} from '@/features/analytics/actions/save-destination';
import type { MeasurementDestination } from '@/features/analytics/types';
import { MEASUREMENT_PROVIDERS } from '@/features/analytics/validation/analytics';
import { formatDateTime } from '@/lib/dates';

export interface MeasurementConsoleProps {
  /** The destinations configured today. */
  destinations: readonly MeasurementDestination[];
}

type ProviderKey = (typeof MEASUREMENT_PROVIDERS)[number];

const PROVIDER_LABELS: Readonly<Record<ProviderKey, string>> = {
  ga4: 'Website analytics property',
  gtm: 'Tag container',
  meta_pixel: 'Social advertising pixel',
  tiktok: 'Short video advertising pixel',
  linkedin: 'Professional network insight tag',
  x_ads: 'Microblog advertising tag',
  clarity: 'Session behaviour recorder',
  plausible: 'Privacy first analytics',
  search_console: 'Search console verification',
};

const PROVIDER_HINTS: Readonly<Record<ProviderKey, string>> = {
  ga4: 'The measurement identifier, which starts with a G.',
  gtm: 'The container identifier, which starts with GTM.',
  meta_pixel: 'The numeric pixel identifier from the events manager.',
  tiktok: 'The pixel identifier from the events manager.',
  linkedin: 'The partner identifier from the campaign manager.',
  x_ads: 'The pixel identifier from the ads manager.',
  clarity: 'The project identifier from the recorder.',
  plausible: 'The domain this site is registered under.',
  search_console: 'The verification string given by the search console.',
};

/** Tools that also accept reports sent from a server rather than a browser. */
const SERVER_REPORTING: readonly ProviderKey[] = ['meta_pixel', 'tiktok', 'linkedin'];

/**
 * Renders the measurement console.
 *
 * @param props The destinations configured today.
 * @returns The rendered console.
 */
export function MeasurementConsole({ destinations }: MeasurementConsoleProps) {
  const router = useRouter();

  const [provider, setProvider] = useState<ProviderKey>('ga4');
  const [label, setLabel] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [consentCategory, setConsentCategory] = useState<'analytics' | 'marketing' | 'necessary'>(
    'analytics'
  );
  const [isEnabled, setIsEnabled] = useState(true);
  const [onMarketing, setOnMarketing] = useState(true);
  const [onApplication, setOnApplication] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves whatever is in the form.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveMeasurementDestination({
      providerKey: provider,
      label: label === '' ? PROVIDER_LABELS[provider] : label,
      publicIdentifier: identifier,
      consentCategory,
      isEnabled,
      loadsOnMarketingPages: onMarketing,
      loadsOnApplicationPages: onApplication,
      accessToken: accessToken === '' ? undefined : accessToken,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved. It loads on the next page view, once consent allows it.');
    setLabel('');
    setIdentifier('');
    setAccessToken('');
    router.refresh();
  }

  /**
   * Stops reporting to one destination.
   *
   * @param destinationId Destination being removed.
   * @returns Nothing.
   */
  async function onRemove(destinationId: string): Promise<void> {
    const result = await removeMeasurementDestination({ destinationId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Removed. Nothing more is sent there.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert tone="info" title="Nothing loads before the visitor agrees">
        Each destination belongs to a consent category. A visitor who accepts analytics but refuses
        marketing meets the analytics property and never meets an advertising pixel, and changing
        that choice takes effect without a reload.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Add a destination</CardTitle>
          <CardDescription>
            Copy the identifier from the provider. It is public by design and appears in the page
            source of every site that uses it; the token some providers also give you is a secret
            and is encrypted here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="destination-provider" label="What are you connecting" isRequired>
              <Select
                id="destination-provider"
                value={provider}
                options={MEASUREMENT_PROVIDERS.map((entry) => ({
                  value: entry,
                  label: PROVIDER_LABELS[entry],
                }))}
                onChange={(event) => setProvider(event.target.value as ProviderKey)}
              />
            </FormField>

            <FormField
              id="destination-identifier"
              label="Identifier"
              hint={PROVIDER_HINTS[provider]}
              errors={fieldErrors['publicIdentifier']}
              isRequired
            >
              <Input
                id="destination-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </FormField>

            <FormField
              id="destination-label"
              label="What to call it here"
              hint="Only for this screen. Left empty it names itself."
              errors={fieldErrors['label']}
            >
              <Input
                id="destination-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </FormField>

            <FormField
              id="destination-consent"
              label="Consent it needs"
              hint="Advertising tools belong under marketing, measurement under analytics."
            >
              <Select
                id="destination-consent"
                value={consentCategory}
                options={[
                  { value: 'analytics', label: 'Analytics consent' },
                  { value: 'marketing', label: 'Marketing consent' },
                  { value: 'necessary', label: 'Strictly necessary' },
                ]}
                onChange={(event) => {
                  const value = event.target.value;

                  setConsentCategory(
                    value === 'marketing'
                      ? 'marketing'
                      : value === 'necessary'
                        ? 'necessary'
                        : 'analytics'
                  );
                }}
              />
            </FormField>

            {SERVER_REPORTING.includes(provider) ? (
              <FormField
                id="destination-token"
                label="Server reporting token"
                hint="Optional. Lets conversions be reported without the browser. Encrypted and never shown again."
              >
                <Input
                  id="destination-token"
                  type="password"
                  autoComplete="off"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                />
              </FormField>
            ) : null}
          </div>

          <div className="space-y-3">
            <Checkbox
              id="destination-enabled"
              label="Switch this on"
              description="Off keeps the identifier here without loading anything."
              checked={isEnabled}
              onChange={(event) => setIsEnabled(event.target.checked)}
            />
            <Checkbox
              id="destination-marketing-pages"
              label="Load it on the public website"
              description="The pages anybody can see."
              checked={onMarketing}
              onChange={(event) => setOnMarketing(event.target.checked)}
            />
            <Checkbox
              id="destination-application-pages"
              label="Load it inside the signed in application"
              description="Leave off unless you have a reason. These pages carry client data."
              checked={onApplication}
              onChange={(event) => setOnApplication(event.target.checked)}
            />
          </div>

          <Button isLoading={isSaving} loadingLabel="Saving" onClick={() => void onSave()}>
            Save this destination
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where this site reports</CardTitle>
          <CardDescription>
            {destinations.length === 0
              ? 'Nothing is measured yet.'
              : 'Everything configured, whether it is live, and what consent it waits for.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a destination above and it starts reporting on the next page view.
            </p>
          ) : (
            <ul className="space-y-3">
              {destinations.map((destination) => (
                <li
                  key={destination.destinationId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{destination.label}</p>
                      <Badge tone={destination.isEnabled ? 'success' : 'neutral'}>
                        {destination.isEnabled ? 'Live' : 'Off'}
                      </Badge>
                      <Badge tone="info">{`${destination.consentCategory} consent`}</Badge>
                      {destination.hasAccessToken ? (
                        <Badge tone="neutral">{`Server token ${destination.tokenHint ?? 'stored'}`}</Badge>
                      ) : null}
                    </div>
                    <p className="tabular text-sm text-muted-foreground">
                      {destination.publicIdentifier}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {`${destination.loadsOnMarketingPages ? 'Public website' : 'Not on the public website'}, ${
                        destination.loadsOnApplicationPages
                          ? 'and inside the application'
                          : 'not inside the application'
                      }. Changed ${formatDateTime(destination.updatedAt)}.`}
                    </p>
                  </div>

                  <Button variant="ghost" onClick={() => void onRemove(destination.destinationId)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
