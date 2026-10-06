// src/components/developers/register-app-form.tsx
// Registering an application. Nothing here is irreversible except the
// secret, which is handed back once and never stored in readable form.

'use client';

import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { registerDeveloperApp } from '@/features/developers/actions/register-app';
import { API_SCOPES } from '@/features/developers/scopes';

export interface RegisterAppFormProps {
  /** True while the dialog is open. */
  isOpen: boolean;
  /** Closes the dialog. */
  onClose: () => void;
  /** Called with the credentials once the application exists. */
  onRegistered: (credentials: { clientId: string; clientSecret: string }) => void;
}

const TYPE_OPTIONS = [
  { value: 'oauth', label: 'Connects on behalf of an account' },
  { value: 'extension', label: 'Browser extension' },
  { value: 'webhook_consumer', label: 'Listens to events only' },
  { value: 'api_key', label: 'Server to server script' },
];

/**
 * Renders the register dialog.
 *
 * @param props Dialog state and what to do once it succeeds.
 * @returns The rendered dialog.
 */
export function RegisterAppForm({ isOpen, onClose, onRegistered }: RegisterAppFormProps) {
  const [appName, setAppName] = useState('');
  const [appSlug, setAppSlug] = useState('');
  const [appType, setAppType] = useState('oauth');
  const [scopes, setScopes] = useState<string[]>(['invoices:read']);
  const [isWorking, setIsWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Turns one permission on or off.
   *
   * @param key Scope being changed.
   * @returns Nothing.
   */
  function toggleScope(key: string): void {
    setScopes((current) =>
      current.includes(key) ? current.filter((scope) => scope !== key) : [...current, key]
    );
  }

  /**
   * Registers the application.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFormError(null);

    const result = await registerDeveloperApp({
      appName,
      appSlug: appSlug.length > 0 ? appSlug : appName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      appType:
        appType === 'oauth'
          ? 'oauth'
          : appType === 'extension'
            ? 'extension'
            : appType === 'api_key'
              ? 'api_key'
              : 'webhook_consumer',
      requestedScopes: scopes,
    });

    setIsWorking(false);

    if (!result.success) {
      setFormError(result.error);

      return;
    }

    notify.success('The application is registered.');
    setAppName('');
    setAppSlug('');
    onRegistered({ clientId: result.data.clientId, clientSecret: result.data.clientSecret });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register an application"
      description="Give it a name, say how it connects, and choose the permissions it will ask accounts for."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {formError ? (
          <Alert tone="danger" title="That did not work">
            {formError}
          </Alert>
        ) : null}

        <FormField id="app-name" label="Name" isRequired>
          <Input
            value={appName}
            onChange={(event) => setAppName(event.target.value)}
            {...fieldAccessibilityProps('app-name', false, false)}
          />
        </FormField>

        <FormField
          id="app-slug"
          label="Address"
          hint="Lowercase letters, numbers and hyphens. Left empty, it is made from the name."
        >
          <Input
            value={appSlug}
            onChange={(event) => setAppSlug(event.target.value)}
            {...fieldAccessibilityProps('app-slug', true, false)}
          />
        </FormField>

        <FormField id="app-type" label="How it connects" isRequired>
          <Select
            options={TYPE_OPTIONS}
            value={appType}
            onChange={(event) => setAppType(event.target.value)}
            {...fieldAccessibilityProps('app-type', false, false)}
          />
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Permissions it will ask for</legend>
          {API_SCOPES.map((scope) => (
            <Checkbox
              key={scope.key}
              label={scope.label}
              description={scope.description}
              checked={scopes.includes(scope.key)}
              onChange={() => toggleScope(scope.key)}
            />
          ))}
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isWorking} loadingLabel="Registering">
            Register
          </Button>
        </div>
      </form>
    </Modal>
  );
}
