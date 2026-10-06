// src/components/integrations/integration-manager.tsx
// Every service this platform talks to, and the keys it talks with.
//
// The rule this screen exists to honour: a key can be changed here and works
// on the next request, with no deployment and no restart. A stored key is
// never shown back, only the hint of its last characters, which is enough to
// recognise it and useless to anybody looking over a shoulder. Nothing can
// be switched on until the provider has answered a test at least once.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { rotateIntegrationCredential } from '@/features/integrations/actions/rotate-credential';
import { saveIntegrationCredential } from '@/features/integrations/actions/save-credential';
import {
  disableIntegration,
  enableIntegration,
} from '@/features/integrations/actions/set-integration-state';
import { testIntegrationConnection } from '@/features/integrations/actions/test-connection';
import type { IntegrationSummary } from '@/features/integrations/types';
import { formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface IntegrationManagerProps {
  /** Everything that can be connected, with its current state. */
  integrations: readonly IntegrationSummary[];
  /** True when these are the platform connections rather than a tenant's. */
  isPlatformScope: boolean;
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  working: 'success',
  untested: 'warning',
  failing: 'danger',
  disabled: 'neutral',
  not_configured: 'neutral',
};

/**
 * Renders the integration console.
 *
 * @param props The connections and whose they are.
 * @returns The rendered console.
 */
export function IntegrationManager({ integrations, isPlatformScope }: IntegrationManagerProps) {
  const router = useRouter();

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'live' | 'test'>('live');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const categories = Array.from(new Set(integrations.map((entry) => entry.category))).sort();

  /**
   * Opens the form for one provider.
   *
   * @param integration The provider being configured.
   * @param rotate True when this is a replacement rather than a first save.
   * @returns Nothing.
   */
  function openForm(integration: IntegrationSummary, rotate: boolean): void {
    setOpenKey(integration.providerKey);
    setEnvironment(integration.environment === 'test' ? 'test' : 'live');
    setValues({});
    setIsRotating(rotate);
  }

  /**
   * Saves or replaces the keys of one provider.
   *
   * @param integration The provider being configured.
   * @returns Nothing.
   */
  async function onSave(integration: IntegrationSummary): Promise<void> {
    setBusyKey(integration.providerKey);

    const result =
      isRotating && integration.credentialId !== null
        ? await rotateIntegrationCredential({
            credentialId: integration.credentialId,
            providerKey: integration.providerKey,
            values,
            graceMinutes: 5,
          })
        : await saveIntegrationCredential({
            providerKey: integration.providerKey,
            environment,
            isPlatformScope,
            values,
          });

    setBusyKey(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      isRotating
        ? 'Replaced. The previous key keeps working for five more minutes.'
        : 'Saved. Test the connection before switching it on.'
    );
    setOpenKey(null);
    setValues({});
    router.refresh();
  }

  /**
   * Asks the provider whether the stored keys work.
   *
   * @param integration The provider being tested.
   * @returns Nothing.
   */
  async function onTest(integration: IntegrationSummary): Promise<void> {
    if (integration.credentialId === null) {
      return;
    }

    setBusyKey(integration.providerKey);
    const result = await testIntegrationConnection({ credentialId: integration.credentialId });
    setBusyKey(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    if (result.data.isHealthy) {
      notify.success(result.data.message);
    } else {
      notify.error(result.data.message);
    }

    router.refresh();
  }

  /**
   * Switches one connection on or off.
   *
   * @param integration The provider being switched.
   * @param nextState True to switch it on.
   * @returns Nothing.
   */
  async function onToggle(integration: IntegrationSummary, nextState: boolean): Promise<void> {
    if (integration.credentialId === null) {
      return;
    }

    setBusyKey(integration.providerKey);

    const result = nextState
      ? await enableIntegration({ credentialId: integration.credentialId })
      : await disableIntegration({ credentialId: integration.credentialId });

    setBusyKey(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(nextState ? 'This connection is now live.' : 'This connection is switched off.');
    router.refresh();
  }

  if (integrations.length === 0) {
    return (
      <EmptyState
        title="Nothing can be connected yet"
        description="The catalogue of services is empty, which usually means the platform has not finished its first run setup."
      />
    );
  }

  return (
    <div className="space-y-8">
      <Alert tone="info" title="Keys take effect immediately">
        Anything saved here is encrypted, applied within seconds across the whole platform, and
        never shown again. Replacing a key keeps the previous one working for five minutes so a
        request already on its way is not lost.
      </Alert>

      {categories.map((category) => (
        <section key={category} className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">{humanise(category)}</h2>

          <div className="space-y-3">
            {integrations
              .filter((integration) => integration.category === category)
              .map((integration) => {
                const isOpen = openKey === integration.providerKey;
                const isBusy = busyKey === integration.providerKey;
                const hints = Object.entries(integration.maskedHints);

                return (
                  <Card key={integration.providerKey}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{integration.name}</CardTitle>
                        <Badge tone={STATUS_TONES[integration.status] ?? 'neutral'}>
                          {humanise(integration.status)}
                        </Badge>
                        {integration.credentialId === null ? null : (
                          <Badge tone="neutral">{humanise(integration.environment)}</Badge>
                        )}
                        {integration.isEnabled ? <Badge tone="success">Live</Badge> : null}
                      </div>
                      <CardDescription>{integration.summary}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {hints.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nothing is stored for this service yet.
                        </p>
                      ) : (
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          {hints.map(([key, hint]) => (
                            <div key={key} className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">{humanise(key)}</dt>
                              <dd className="tabular">{hint}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      <dl className="grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">Last tested</dt>
                          <dd>
                            {integration.lastTestedAt === null
                              ? 'Never'
                              : formatDateTime(integration.lastTestedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Last used</dt>
                          <dd>
                            {integration.lastUsedAt === null
                              ? 'Never'
                              : formatDateTime(integration.lastUsedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Configured by</dt>
                          <dd>{humanise(integration.scope ?? integration.configurableBy)}</dd>
                        </div>
                      </dl>

                      {integration.lastError === null ? null : (
                        <Alert tone="danger" title="The last attempt failed">
                          {integration.lastErrorAt === null
                            ? integration.lastError
                            : `${integration.lastError} (${formatDateTime(integration.lastErrorAt)})`}
                        </Alert>
                      )}

                      {isOpen ? (
                        <div className="space-y-4 rounded-lg border border-border p-4">
                          {isRotating ? (
                            <Alert tone="info" title="Replacing a key in use">
                              The key you enter here takes over immediately. The one it replaces
                              keeps working for five more minutes, then stops.
                            </Alert>
                          ) : (
                            <FormField
                              id={`${integration.providerKey}-environment`}
                              label="Which environment these keys are for"
                            >
                              <Select
                                id={`${integration.providerKey}-environment`}
                                value={environment}
                                options={[
                                  { value: 'live', label: 'Live, real money' },
                                  { value: 'test', label: 'Test, nothing real' },
                                ]}
                                onChange={(event) => {
                                  setEnvironment(event.target.value === 'test' ? 'test' : 'live');
                                }}
                              />
                            </FormField>
                          )}

                          {integration.fields.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              This service needs no keys.
                            </p>
                          ) : (
                            integration.fields.map((field) => (
                              <FormField
                                key={field.key}
                                id={`${integration.providerKey}-${field.key}`}
                                label={field.label}
                                hint={
                                  field.envVar === null
                                    ? undefined
                                    : `Falls back to the ${field.envVar} environment variable when left empty.`
                                }
                                isRequired={field.isRequired}
                              >
                                <Input
                                  id={`${integration.providerKey}-${field.key}`}
                                  type={field.isSecret ? 'password' : 'text'}
                                  autoComplete="off"
                                  value={values[field.key] ?? ''}
                                  onChange={(event) => {
                                    setValues({ ...values, [field.key]: event.target.value });
                                  }}
                                />
                              </FormField>
                            ))
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              isLoading={isBusy}
                              loadingLabel="Saving"
                              onClick={() => void onSave(integration)}
                            >
                              {isRotating ? 'Replace the key' : 'Save these keys'}
                            </Button>
                            <Button variant="ghost" onClick={() => setOpenKey(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => openForm(integration, false)}>
                            {integration.credentialId === null ? 'Add keys' : 'Change keys'}
                          </Button>

                          {integration.credentialId === null ? null : (
                            <>
                              <Button
                                variant="secondary"
                                isLoading={isBusy}
                                loadingLabel="Testing"
                                onClick={() => void onTest(integration)}
                              >
                                Test connection
                              </Button>

                              <Button
                                variant="secondary"
                                onClick={() => openForm(integration, true)}
                              >
                                Rotate key
                              </Button>

                              <Button
                                variant={integration.isEnabled ? 'ghost' : 'primary'}
                                onClick={() => void onToggle(integration, !integration.isEnabled)}
                              >
                                {integration.isEnabled ? 'Switch off' : 'Switch on'}
                              </Button>
                            </>
                          )}

                          {integration.documentationUrl === null ? null : (
                            <a
                              className="inline-flex min-h-touch items-center text-sm text-brand-700 underline"
                              href={integration.documentationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Where to find these keys
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
