// src/components/gateways/gateway-form.tsx
// Connecting a payment provider. The fields come from the provider
// catalogue, so a provider nobody has built an integration for is connected
// the same way as Stripe.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { GATEWAY_CATALOG, GATEWAY_ORDER } from '@/features/gateways/catalog';
import { saveGateway } from '@/features/gateways/actions/save-gateway';
import type { GatewayConnection } from '@/features/gateways/types';
import type { GatewayProvider } from '@/types/enums';

export interface GatewayFormProps {
  /** True while the dialog is open. */
  isOpen: boolean;
  /** Closes the dialog. */
  onClose: () => void;
  /** The connection being edited, or null when adding a new one. */
  connection: GatewayConnection | null;
}

const PROVIDER_OPTIONS = GATEWAY_ORDER.map((provider) => ({
  value: provider,
  label: GATEWAY_CATALOG[provider].label,
}));

const MODE_OPTIONS = [
  { value: 'test', label: 'Test — nothing real is charged' },
  { value: 'live', label: 'Live — real money moves' },
];

/**
 * Renders the connect dialog.
 *
 * @param props The dialog state and the connection being edited.
 * @returns The rendered dialog.
 */
export function GatewayForm({ isOpen, onClose, connection }: GatewayFormProps) {
  const router = useRouter();
  const [provider, setProvider] = useState<GatewayProvider>(connection?.provider ?? 'stripe');
  const [displayName, setDisplayName] = useState(connection?.displayName ?? '');
  const [mode, setMode] = useState(connection?.mode ?? 'test');
  const [publishableKey, setPublishableKey] = useState(connection?.publishableKey ?? '');
  const [instructions, setInstructions] = useState(connection?.instructions ?? '');
  const [adapterConfig, setAdapterConfig] = useState('{}');
  const [feePercentage, setFeePercentage] = useState(connection?.feePercentage ?? '0');
  const [feeFixedAmount, setFeeFixedAmount] = useState(connection?.feeFixedAmount ?? '0');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isWorking, setIsWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const definition = GATEWAY_CATALOG[provider];

  /**
   * Stores the connection.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFormError(null);

    const result = await saveGateway({
      gatewayId: connection?.id,
      provider,
      displayName: displayName.trim().length > 0 ? displayName : definition.label,
      mode,
      credentials,
      publishableKey,
      instructions,
      adapterConfig,
      feePercentage,
      feeFixedAmount,
    });

    setIsWorking(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    notify.success('Connection saved. Test it before you switch it on.');
    setCredentials({});
    onClose();
    router.refresh();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={connection ? `Edit ${connection.displayName}` : 'Connect a payment provider'}
      description="Your keys are encrypted before they are stored, and are never shown again."
      size="lg"
    >
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="space-y-5"
      >
        {formError ? (
          <Alert tone="danger" title="The connection was not saved">
            {formError}
          </Alert>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="gateway-provider" label="Provider">
            <Select
              id="gateway-provider"
              options={PROVIDER_OPTIONS}
              value={provider}
              disabled={isWorking || connection !== null}
              onChange={(event) => {
                setProvider(event.target.value as GatewayProvider);
                setCredentials({});
              }}
            />
          </FormField>

          <FormField id="gateway-mode" label="Mode">
            <Select
              id="gateway-mode"
              options={MODE_OPTIONS}
              value={mode}
              disabled={isWorking}
              onChange={(event) => {
                setMode(event.target.value === 'live' ? 'live' : 'test');
              }}
            />
          </FormField>

          <FormField
            id="gateway-name"
            label="What you call this connection"
            hint="Shown in your own lists, never to a client."
          >
            <Input
              {...fieldAccessibilityProps('gateway-name', true, false)}
              value={displayName}
              placeholder={definition.label}
              disabled={isWorking}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
            />
          </FormField>

          <FormField id="gateway-publishable" label="Publishable key">
            <Input
              {...fieldAccessibilityProps('gateway-publishable', false, false)}
              value={publishableKey}
              disabled={isWorking}
              onChange={(event) => {
                setPublishableKey(event.target.value);
              }}
            />
          </FormField>
        </div>

        <p className="text-sm text-muted-foreground">{definition.description}</p>

        {definition.fields.length === 0 ? (
          <Alert tone="info" title="Nothing to connect">
            Your clients see the bank details from your business profile, and you record the payment
            when it arrives.
          </Alert>
        ) : (
          <div className="space-y-5">
            {definition.fields.map((field) => (
              <FormField
                key={field.key}
                id={`gateway-${field.key}`}
                label={field.label}
                hint={field.hint}
                isRequired={field.isRequired && connection === null}
              >
                <Input
                  {...fieldAccessibilityProps(`gateway-${field.key}`, true, false)}
                  type={field.isSecret ? 'password' : 'text'}
                  autoComplete="off"
                  value={credentials[field.key] ?? ''}
                  placeholder={connection ? 'Leave empty to keep the stored value' : ''}
                  disabled={isWorking}
                  onChange={(event) => {
                    setCredentials((current) => ({ ...current, [field.key]: event.target.value }));
                  }}
                />
              </FormField>
            ))}
          </div>
        )}

        {definition.usesCustomAdapter ? (
          <FormField
            id="gateway-config"
            label="Connection settings"
            hint="A JSON object. Give it a test_url entry with the address we should call to check the keys."
          >
            <Textarea
              {...fieldAccessibilityProps('gateway-config', true, false)}
              rows={4}
              value={adapterConfig}
              disabled={isWorking}
              onChange={(event) => {
                setAdapterConfig(event.target.value);
              }}
            />
          </FormField>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="gateway-fee-percentage"
            label="Provider fee percentage"
            hint="Used to show your clients and your reports the true cost."
          >
            <Input
              {...fieldAccessibilityProps('gateway-fee-percentage', true, false)}
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={feePercentage}
              disabled={isWorking}
              onChange={(event) => {
                setFeePercentage(event.target.value);
              }}
            />
          </FormField>

          <FormField id="gateway-fee-fixed" label="Fixed fee per payment">
            <Input
              {...fieldAccessibilityProps('gateway-fee-fixed', false, false)}
              type="number"
              step="0.01"
              min="0"
              value={feeFixedAmount}
              disabled={isWorking}
              onChange={(event) => {
                setFeeFixedAmount(event.target.value);
              }}
            />
          </FormField>
        </div>

        <FormField
          id="gateway-instructions"
          label="What your client is told"
          hint="Shown beside this method on the payment page."
        >
          <Textarea
            {...fieldAccessibilityProps('gateway-instructions', true, false)}
            rows={3}
            value={instructions}
            disabled={isWorking}
            onChange={(event) => {
              setInstructions(event.target.value);
            }}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={isWorking} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isWorking} loadingLabel="Saving">
            Save connection
          </Button>
        </div>
      </form>
    </Modal>
  );
}
