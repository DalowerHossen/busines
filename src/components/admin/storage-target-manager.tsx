// src/components/admin/storage-target-manager.tsx
// Running the places the platform keeps files.
//
// Three things matter on this screen and nothing else: whether a store
// answers, which store new files land in, and being able to replace its keys
// without a deployment. Keys are never shown back; only the fingerprint of
// what is stored is, which is enough to tell two pairs apart.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { saveStorageTarget } from '@/features/storage/actions/save-target';
import { setStorageCredentials } from '@/features/storage/actions/set-credentials';
import { testStorageTarget } from '@/features/storage/actions/test-target';
import type { StorageTargetSummary } from '@/features/storage/types';
import { formatDateTime } from '@/lib/dates';
import { formatFileSize, formatNumber, humanise } from '@/lib/format';

export interface StorageTargetManagerProps {
  /** Every store the platform knows about. */
  targets: readonly StorageTargetSummary[];
}

interface TargetForm {
  name: string;
  provider: string;
  bucketName: string;
  region: string;
  endpointUrl: string;
  pathPrefix: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: string;
  maxUploadBytes: string;
  isActive: boolean;
  isDefault: boolean;
}

interface CredentialForm {
  accessKeyId: string;
  secretAccessKey: string;
  serviceKey: string;
  projectUrl: string;
}

const PROVIDER_OPTIONS = [
  { value: 'cloudflare_r2', label: 'Object store behind a content network' },
  { value: 'aws_s3', label: 'Large cloud object store' },
  { value: 'backblaze_b2', label: 'Low cost object store' },
  { value: 'wasabi', label: 'Flat rate object store' },
  { value: 'supabase', label: 'Managed bucket beside the database' },
  { value: 'local_disk', label: 'The disk of this server' },
  { value: 'google_drive', label: 'A cloud drive connected by a business' },
];

const EMPTY_FORM: TargetForm = {
  name: '',
  provider: 'cloudflare_r2',
  bucketName: '',
  region: 'auto',
  endpointUrl: '',
  pathPrefix: 'tenants',
  publicBaseUrl: '',
  forcePathStyle: true,
  signedUrlTtlSeconds: '900',
  maxUploadBytes: '26214400',
  isActive: true,
  isDefault: false,
};

const EMPTY_CREDENTIALS: CredentialForm = {
  accessKeyId: '',
  secretAccessKey: '',
  serviceKey: '',
  projectUrl: '',
};

/**
 * Renders the storage console.
 *
 * @param props Every store the platform knows about.
 * @returns The rendered console.
 */
export function StorageTargetManager({ targets }: StorageTargetManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<TargetForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});
  const [keyingId, setKeyingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialForm>(EMPTY_CREDENTIALS);
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Changes one field of the store form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onChange(key: keyof TargetForm, value: string | boolean): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * Loads one store into the form so it can be changed.
   *
   * @param target Store being edited.
   * @returns Nothing.
   */
  function onEdit(target: StorageTargetSummary): void {
    setEditingId(target.targetId);
    setFailure(null);
    setFieldErrors({});
    setForm({
      name: target.name,
      provider: target.provider,
      bucketName: target.bucketName,
      region: target.region ?? '',
      endpointUrl: target.endpointUrl ?? '',
      pathPrefix: target.pathPrefix ?? '',
      publicBaseUrl: target.publicBaseUrl ?? '',
      forcePathStyle: target.forcePathStyle,
      signedUrlTtlSeconds: String(target.signedUrlTtlSeconds),
      maxUploadBytes: String(target.maxUploadBytes),
      isActive: target.isActive,
      isDefault: target.isDefault,
    });
  }

  /**
   * Saves the store in the form.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveStorageTarget({
      targetId: editingId ?? undefined,
      name: form.name,
      provider: form.provider,
      bucketName: form.bucketName,
      region: form.region.trim() === '' ? undefined : form.region.trim(),
      endpointUrl: form.endpointUrl.trim() === '' ? undefined : form.endpointUrl.trim(),
      pathPrefix: form.pathPrefix.trim() === '' ? undefined : form.pathPrefix.trim(),
      publicBaseUrl: form.publicBaseUrl.trim() === '' ? undefined : form.publicBaseUrl.trim(),
      forcePathStyle: form.forcePathStyle,
      signedUrlTtlSeconds: form.signedUrlTtlSeconds,
      maxUploadBytes: form.maxUploadBytes,
      isActive: form.isActive,
      isDefault: form.isDefault,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success(editingId === null ? 'That store is configured.' : 'That store is updated.');
    setEditingId(null);
    setForm(EMPTY_FORM);
    router.refresh();
  }

  /**
   * Stores new keys against one store.
   *
   * @param targetId Store being keyed.
   * @returns Nothing.
   */
  async function onSaveKeys(targetId: string): Promise<void> {
    setBusyId(targetId);

    const result = await setStorageCredentials({
      targetId,
      accessKeyId: credentials.accessKeyId.trim() === '' ? undefined : credentials.accessKeyId,
      secretAccessKey:
        credentials.secretAccessKey.trim() === '' ? undefined : credentials.secretAccessKey,
      serviceKey: credentials.serviceKey.trim() === '' ? undefined : credentials.serviceKey,
      projectUrl: credentials.projectUrl.trim() === '' ? undefined : credentials.projectUrl,
    });

    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('The new keys are live. The old pair works for five more minutes.');
    setKeyingId(null);
    setCredentials(EMPTY_CREDENTIALS);
    router.refresh();
  }

  /**
   * Asks a store whether it is reachable.
   *
   * @param targetId Store being tested.
   * @returns Nothing.
   */
  async function onTest(targetId: string): Promise<void> {
    setBusyId(targetId);
    const result = await testStorageTarget({ targetId });
    setBusyId(null);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stores in use</CardTitle>
          <CardDescription>
            New files land in the default store. A tenant with its own bucket keeps writing to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {targets.length === 0 ? (
            <EmptyState
              title="No store is configured"
              description="Add the first store below. Until one exists, uploads will be refused rather than silently lost."
            />
          ) : (
            <ul className="space-y-3">
              {targets.map((target) => (
                <li key={target.targetId} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{target.name}</p>
                        {target.isDefault ? <Badge tone="success">Default</Badge> : null}
                        {target.isActive ? null : <Badge tone="neutral">Switched off</Badge>}
                        {target.companyId === null ? null : (
                          <Badge tone="warning">Belongs to one business</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {`${humanise(target.provider)}, bucket ${target.bucketName}${
                          target.region === null ? '' : `, region ${target.region}`
                        }.`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {`${formatNumber(target.fileCount)} files, ${formatFileSize(
                          target.storedBytes
                        )} stored, up to ${formatFileSize(target.maxUploadBytes)} per upload.`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {target.hasCredentials
                          ? `Keys stored, fingerprint ${
                              target.credentialsFingerprint === null
                                ? 'unknown'
                                : target.credentialsFingerprint.slice(0, 12)
                            }.`
                          : 'No keys stored yet.'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {target.lastVerifiedAt === null
                          ? 'It has never been tested.'
                          : `Last answered ${formatDateTime(target.lastVerifiedAt)}.`}
                      </p>
                      {target.lastError !== null ? (
                        <p className="text-danger text-sm">{target.lastError}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busyId === target.targetId}
                        onClick={() => onEdit(target)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        isLoading={busyId === target.targetId}
                        loadingLabel="Testing"
                        onClick={() => void onTest(target.targetId)}
                      >
                        Test connection
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyId === target.targetId}
                        onClick={() => {
                          setKeyingId(keyingId === target.targetId ? null : target.targetId);
                          setCredentials(EMPTY_CREDENTIALS);
                        }}
                      >
                        {target.hasCredentials ? 'Replace keys' : 'Add keys'}
                      </Button>
                    </div>
                  </div>

                  {keyingId === target.targetId ? (
                    <div className="space-y-4 rounded-md bg-surface-muted p-4">
                      <p className="text-sm text-muted-foreground">
                        Keys are encrypted before they are stored and are never shown again. The
                        pair being replaced keeps working for five minutes.
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField id={`key-id-${target.targetId}`} label="Access key">
                          <Input
                            id={`key-id-${target.targetId}`}
                            value={credentials.accessKeyId}
                            autoComplete="off"
                            onChange={(event) =>
                              setCredentials((current) => ({
                                ...current,
                                accessKeyId: event.target.value,
                              }))
                            }
                          />
                        </FormField>

                        <FormField id={`key-secret-${target.targetId}`} label="Secret">
                          <Input
                            id={`key-secret-${target.targetId}`}
                            type="password"
                            value={credentials.secretAccessKey}
                            autoComplete="new-password"
                            onChange={(event) =>
                              setCredentials((current) => ({
                                ...current,
                                secretAccessKey: event.target.value,
                              }))
                            }
                          />
                        </FormField>

                        <FormField
                          id={`key-service-${target.targetId}`}
                          label="Service key"
                          hint="Only for the managed bucket beside the database."
                        >
                          <Input
                            id={`key-service-${target.targetId}`}
                            type="password"
                            value={credentials.serviceKey}
                            autoComplete="new-password"
                            onChange={(event) =>
                              setCredentials((current) => ({
                                ...current,
                                serviceKey: event.target.value,
                              }))
                            }
                          />
                        </FormField>

                        <FormField
                          id={`key-project-${target.targetId}`}
                          label="Service address"
                          hint="Only for the managed bucket beside the database."
                        >
                          <Input
                            id={`key-project-${target.targetId}`}
                            value={credentials.projectUrl}
                            autoComplete="off"
                            onChange={(event) =>
                              setCredentials((current) => ({
                                ...current,
                                projectUrl: event.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          isLoading={busyId === target.targetId}
                          loadingLabel="Storing"
                          onClick={() => void onSaveKeys(target.targetId)}
                        >
                          Store the keys
                        </Button>
                        <Button variant="secondary" onClick={() => setKeyingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId === null ? 'Add a store' : 'Change this store'}</CardTitle>
          <CardDescription>
            Every store speaks the same bucket protocol apart from the managed one and the disk of
            this server, so most of these fields are the same wherever you go.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
            {failure !== null ? (
              <Alert tone="danger" title="That store could not be saved">
                {failure}
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="store-name" label="Name" errors={fieldErrors['name']} isRequired>
                <Input
                  id="store-name"
                  value={form.name}
                  autoComplete="off"
                  onChange={(event) => onChange('name', event.target.value)}
                />
              </FormField>

              <FormField id="store-provider" label="Kind of store" isRequired>
                <Select
                  id="store-provider"
                  options={PROVIDER_OPTIONS}
                  value={form.provider}
                  onChange={(event) => onChange('provider', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-bucket"
                label="Bucket"
                errors={fieldErrors['bucketName']}
                isRequired
              >
                <Input
                  id="store-bucket"
                  value={form.bucketName}
                  autoComplete="off"
                  onChange={(event) => onChange('bucketName', event.target.value)}
                />
              </FormField>

              <FormField id="store-region" label="Region" errors={fieldErrors['region']}>
                <Input
                  id="store-region"
                  value={form.region}
                  autoComplete="off"
                  onChange={(event) => onChange('region', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-endpoint"
                label="Endpoint"
                hint="The address of the store, when it is not the large cloud one."
                errors={fieldErrors['endpointUrl']}
              >
                <Input
                  id="store-endpoint"
                  value={form.endpointUrl}
                  autoComplete="off"
                  onChange={(event) => onChange('endpointUrl', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-prefix"
                label="Key prefix"
                hint="Everything is written under this, which keeps tenants apart inside one bucket."
                errors={fieldErrors['pathPrefix']}
              >
                <Input
                  id="store-prefix"
                  value={form.pathPrefix}
                  autoComplete="off"
                  onChange={(event) => onChange('pathPrefix', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-public"
                label="Delivery address"
                hint="The content network host files are served from."
                errors={fieldErrors['publicBaseUrl']}
              >
                <Input
                  id="store-public"
                  value={form.publicBaseUrl}
                  autoComplete="off"
                  onChange={(event) => onChange('publicBaseUrl', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-ttl"
                label="How long an address lasts, in seconds"
                errors={fieldErrors['signedUrlTtlSeconds']}
                isRequired
              >
                <Input
                  id="store-ttl"
                  type="number"
                  min={60}
                  max={604800}
                  value={form.signedUrlTtlSeconds}
                  onChange={(event) => onChange('signedUrlTtlSeconds', event.target.value)}
                />
              </FormField>

              <FormField
                id="store-max"
                label="Largest upload, in bytes"
                errors={fieldErrors['maxUploadBytes']}
                isRequired
              >
                <Input
                  id="store-max"
                  type="number"
                  min={1024}
                  value={form.maxUploadBytes}
                  onChange={(event) => onChange('maxUploadBytes', event.target.value)}
                />
              </FormField>
            </div>

            <Checkbox
              label="Address the bucket by path rather than by host"
              description="Most stores other than the large cloud one need this."
              checked={form.forcePathStyle}
              onChange={(event) => onChange('forcePathStyle', event.target.checked)}
            />

            <Checkbox
              label="This store is in use"
              checked={form.isActive}
              onChange={(event) => onChange('isActive', event.target.checked)}
            />

            <Checkbox
              label="New files land here"
              description="Only one store can be the default. Choosing this moves it from wherever it is now."
              checked={form.isDefault}
              onChange={(event) => onChange('isDefault', event.target.checked)}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                {editingId === null ? 'Add store' : 'Save changes'}
              </Button>
              {editingId !== null ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_FORM);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
