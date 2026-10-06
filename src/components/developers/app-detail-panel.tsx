// src/components/developers/app-detail-panel.tsx
// One application: how it describes itself, where it may send an
// authorisation, what it is allowed to ask for, and who is using it.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { rotateAppSecret } from '@/features/developers/actions/rotate-secret';
import { saveDeveloperApp } from '@/features/developers/actions/save-app';
import { setAppRedirectUris } from '@/features/developers/actions/set-redirect-uris';
import { submitDeveloperApp } from '@/features/developers/actions/submit-app';
import { API_SCOPES, describeScope } from '@/features/developers/scopes';
import type { DeveloperAppDetail } from '@/features/developers/types';
import { formatDateTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';

export interface AppDetailPanelProps {
  /** The application being opened. */
  app: DeveloperAppDetail;
}

const DISTRIBUTION_OPTIONS = [
  { value: 'private', label: 'Private — only accounts you invite' },
  { value: 'unlisted', label: 'Unlisted — anybody with the link' },
  { value: 'public', label: 'Public — listed in the directory' },
];

/**
 * Renders the detail page of one application.
 *
 * @param props The application being opened.
 * @returns The rendered page body.
 */
export function AppDetailPanel({ app }: AppDetailPanelProps) {
  const router = useRouter();
  const [appName, setAppName] = useState(app.appName);
  const [tagline, setTagline] = useState(app.tagline ?? '');
  const [description, setDescription] = useState(app.description ?? '');
  const [homepageUrl, setHomepageUrl] = useState(app.homepageUrl ?? '');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(app.privacyPolicyUrl ?? '');
  const [supportEmail, setSupportEmail] = useState(app.supportEmail ?? '');
  const [webhookUrl, setWebhookUrl] = useState(app.webhookUrl ?? '');
  const [distribution, setDistribution] = useState(app.distribution);
  const [redirectUris, setRedirectUris] = useState(
    app.redirectUris.map((entry) => entry.redirectUri).join('\n')
  );
  const [scopes, setScopes] = useState<string[]>([...app.requestedScopes]);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Saves how the application describes itself.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy('save');
    setFailure(null);

    const result = await saveDeveloperApp({
      appId: app.appId,
      appName,
      tagline,
      description,
      homepageUrl,
      privacyPolicyUrl,
      supportEmail: supportEmail.length > 0 ? supportEmail : null,
      webhookUrl,
      distribution,
    });

    setBusy(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Saved.');
    router.refresh();
  }

  /**
   * Replaces the registered return addresses.
   *
   * @returns Nothing.
   */
  async function onSaveAddresses(): Promise<void> {
    setBusy('addresses');
    setFailure(null);

    const result = await setAppRedirectUris({
      appId: app.appId,
      redirectUris: redirectUris
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    });

    setBusy(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`${formatNumber(result.data.addressCount)} address(es) registered.`);
    router.refresh();
  }

  /**
   * Puts the application in front of the platform team.
   *
   * @returns Nothing.
   */
  async function onSubmitForReview(): Promise<void> {
    setBusy('submit');
    setFailure(null);

    const result = await submitDeveloperApp({ appId: app.appId, requestedScopes: scopes });
    setBusy(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('The application is with the platform team.');
    router.refresh();
  }

  /**
   * Issues a new client secret.
   *
   * @returns Nothing.
   */
  async function onRotate(): Promise<void> {
    setBusy('rotate');
    setFailure(null);

    const result = await rotateAppSecret({ appId: app.appId });
    setBusy(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    setRotatedSecret(result.data.clientSecret);
    notify.success('A new secret has been issued. The old one works for five more minutes.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      {rotatedSecret ? (
        <Alert tone="warning" title="Copy the new secret now">
          <span className="mt-2 block break-all font-mono text-sm">{rotatedSecret}</span>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>
            The client identifier is public. The secret is shown once, when it is issued.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="break-all font-mono text-sm">client_id: {app.clientId}</p>
          <p className="text-sm text-muted-foreground">
            Secret on record:{' '}
            {app.clientSecretHint === null ? 'none yet' : `ends in ${app.clientSecretHint}`}
            {app.secretRotatedAt === null
              ? ''
              : ` · last replaced ${formatDateTime(app.secretRotatedAt)}`}
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={busy === 'rotate'}
              loadingLabel="Replacing"
              onClick={() => {
                void onRotate();
              }}
            >
              Replace the secret
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it appears to an account</CardTitle>
          <CardDescription>
            This is what an owner reads on the screen where they decide whether to let you in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSave}>
            <FormField id="detail-name" label="Name" isRequired>
              <Input
                value={appName}
                onChange={(event) => setAppName(event.target.value)}
                {...fieldAccessibilityProps('detail-name', false, false)}
              />
            </FormField>

            <FormField id="detail-tagline" label="One line summary">
              <Input
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                {...fieldAccessibilityProps('detail-tagline', false, false)}
              />
            </FormField>

            <FormField id="detail-description" label="What it does">
              <Textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                {...fieldAccessibilityProps('detail-description', false, false)}
              />
            </FormField>

            <FormField id="detail-homepage" label="Homepage">
              <Input
                value={homepageUrl}
                onChange={(event) => setHomepageUrl(event.target.value)}
                {...fieldAccessibilityProps('detail-homepage', false, false)}
              />
            </FormField>

            <FormField id="detail-privacy" label="Privacy policy">
              <Input
                value={privacyPolicyUrl}
                onChange={(event) => setPrivacyPolicyUrl(event.target.value)}
                {...fieldAccessibilityProps('detail-privacy', false, false)}
              />
            </FormField>

            <FormField id="detail-support" label="Support email">
              <Input
                type="email"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
                {...fieldAccessibilityProps('detail-support', false, false)}
              />
            </FormField>

            <FormField
              id="detail-webhook"
              label="Event address"
              hint="Where we post the events this application subscribes to."
            >
              <Input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                {...fieldAccessibilityProps('detail-webhook', true, false)}
              />
            </FormField>

            <FormField id="detail-distribution" label="Who may install it" isRequired>
              <Select
                options={DISTRIBUTION_OPTIONS}
                value={distribution}
                onChange={(event) => {
                  const value = event.target.value;
                  setDistribution(
                    value === 'public' ? 'public' : value === 'unlisted' ? 'unlisted' : 'private'
                  );
                }}
                {...fieldAccessibilityProps('detail-distribution', false, false)}
              />
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" isLoading={busy === 'save'} loadingLabel="Saving">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Return addresses</CardTitle>
          <CardDescription>
            One address per line. An authorisation is only ever sent to an exact match.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField id="redirect-uris" label="Addresses">
            <Textarea
              rows={4}
              value={redirectUris}
              onChange={(event) => setRedirectUris(event.target.value)}
              {...fieldAccessibilityProps('redirect-uris', false, false)}
            />
          </FormField>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              isLoading={busy === 'addresses'}
              loadingLabel="Saving"
              onClick={() => {
                void onSaveAddresses();
              }}
            >
              Save addresses
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            {app.status === 'approved'
              ? 'The platform team approved the permissions below.'
              : 'Choose what the application needs, then send it for review.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {app.status === 'approved' ? (
            <ul className="space-y-2">
              {app.allowedScopes.map((scope) => (
                <li key={scope} className="text-sm">
                  <span className="font-medium">{describeScope(scope).label}</span>
                  <span className="block text-muted-foreground">
                    {describeScope(scope).description}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">What it needs</legend>
                {API_SCOPES.map((scope) => (
                  <Checkbox
                    key={scope.key}
                    label={scope.label}
                    description={scope.description}
                    checked={scopes.includes(scope.key)}
                    onChange={() =>
                      setScopes((current) =>
                        current.includes(scope.key)
                          ? current.filter((entry) => entry !== scope.key)
                          : [...current, scope.key]
                      )
                    }
                  />
                ))}
              </fieldset>

              <div className="flex justify-end">
                <Button
                  type="button"
                  isLoading={busy === 'submit'}
                  loadingLabel="Sending"
                  onClick={() => {
                    void onSubmitForReview();
                  }}
                >
                  Send for review
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts using it</CardTitle>
          <CardDescription>
            Every account that has connected, and how hard the application is working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {app.installs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has connected this application yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connected</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead isNumeric>Requests</TableHead>
                  <TableHead isNumeric>Failures</TableHead>
                  <TableHead>Last used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.installs.map((install) => (
                  <TableRow key={install.installId}>
                    <TableCell>{formatDateTime(install.installedAt)}</TableCell>
                    <TableCell>
                      <Badge tone={install.status === 'active' ? 'success' : 'neutral'}>
                        {install.status === 'active' ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(install.requestCount)}</TableCell>
                    <TableCell isNumeric>{formatNumber(install.errorCount)}</TableCell>
                    <TableCell>
                      {install.lastUsedAt === null ? 'Never' : formatDateTime(install.lastUsedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
