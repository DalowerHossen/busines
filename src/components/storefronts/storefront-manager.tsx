// src/components/storefronts/storefront-manager.tsx
// Connecting a shop, giving it a key, and switching it on or off.
//
// A shop cannot be switched on until the business behind it has passed its
// identity check, so the screen says so plainly rather than failing at the
// moment the owner presses the button.

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
import { issueStorefrontKey } from '@/features/storefronts/actions/issue-key';
import { saveStorefrontConnection } from '@/features/storefronts/actions/save-connection';
import { setStorefrontStatus } from '@/features/storefronts/actions/set-status';
import type { StorefrontConnection } from '@/features/storefronts/types';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface StorefrontManagerProps {
  /** The shops already connected. */
  connections: readonly StorefrontConnection[];
  /** True when the business has passed its identity check. */
  isVerified: boolean;
  /** True when the viewer may change anything here. */
  canManage: boolean;
  /** Currency the business bills in. */
  currency: string;
  /** The address of this installation, used in the examples. */
  baseUrl: string;
}

interface ConnectionForm {
  platform: string;
  storeName: string;
  storeDomain: string;
  notifyUrl: string;
  defaultCurrency: string;
  autoIssueInvoice: boolean;
}

interface IssuedKey {
  connectionId: string;
  storeKey: string;
  webhookSecret: string;
}

const PLATFORM_OPTIONS = [
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'custom', label: 'A shop you built yourself' },
];

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  active: 'success',
  pending_verification: 'warning',
  suspended: 'danger',
  disconnected: 'neutral',
};

/**
 * Renders the shop management screen.
 *
 * @param props The shops, what the viewer may do and the installation address.
 * @returns The rendered screen.
 */
export function StorefrontManager({
  connections,
  isVerified,
  canManage,
  currency,
  baseUrl,
}: StorefrontManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<ConnectionForm>({
    platform: 'woocommerce',
    storeName: '',
    storeDomain: '',
    notifyUrl: '',
    defaultCurrency: currency,
    autoIssueInvoice: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Changes one field of the form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onChange(key: keyof ConnectionForm, value: string | boolean): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * Loads one shop into the form so its details can be changed.
   *
   * @param connection Shop being edited.
   * @returns Nothing.
   */
  function onEdit(connection: StorefrontConnection): void {
    setEditingId(connection.connectionId);
    setFailure(null);
    setFieldErrors({});
    setForm({
      platform: connection.platform,
      storeName: connection.storeName,
      storeDomain: connection.storeDomain,
      notifyUrl: connection.notifyUrl ?? '',
      defaultCurrency: connection.defaultCurrency,
      autoIssueInvoice: connection.autoIssueInvoice,
    });
  }

  /**
   * Saves the shop in the form.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveStorefrontConnection({
      connectionId: editingId ?? undefined,
      platform:
        form.platform === 'shopify' || form.platform === 'custom' ? form.platform : 'woocommerce',
      storeName: form.storeName,
      storeDomain: form.storeDomain,
      notifyUrl: form.notifyUrl.trim() === '' ? undefined : form.notifyUrl.trim(),
      defaultCurrency: form.defaultCurrency.toUpperCase(),
      autoIssueInvoice: form.autoIssueInvoice,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success(editingId === null ? 'That shop is connected.' : 'That shop is updated.');
    setEditingId(null);
    setForm({
      platform: 'woocommerce',
      storeName: '',
      storeDomain: '',
      notifyUrl: '',
      defaultCurrency: currency,
      autoIssueInvoice: true,
    });
    router.refresh();
  }

  /**
   * Issues a fresh key for one shop.
   *
   * @param connectionId Shop being keyed.
   * @returns Nothing.
   */
  async function onIssueKey(connectionId: string): Promise<void> {
    setBusyId(connectionId);
    const result = await issueStorefrontKey({ connectionId });
    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    setIssued({
      connectionId,
      storeKey: result.data.storeKey,
      webhookSecret: result.data.webhookSecret,
    });
    notify.success('Copy the key now. It is not shown again.');
    router.refresh();
  }

  /**
   * Switches one shop on or off.
   *
   * @param connectionId Shop being switched.
   * @param status State it should move to.
   * @returns Nothing.
   */
  async function onSetStatus(connectionId: string, status: string): Promise<void> {
    if (status !== 'active' && status !== 'suspended' && status !== 'disconnected') {
      return;
    }

    setBusyId(connectionId);
    const result = await setStorefrontStatus({ connectionId, status });
    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      status === 'active' ? 'That shop can take payment now.' : 'That shop has been stopped.'
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!isVerified ? (
        <Alert tone="warning" title="Your business has to be verified before a shop can go live">
          Connect the shop and issue its key now if you like. The moment your identity check is
          approved you can switch it on and it will start taking payment.
        </Alert>
      ) : null}

      {issued !== null ? (
        <Alert tone="success" title="Your new shop key">
          <div className="space-y-2 text-sm">
            <p className="break-all">
              <span className="font-medium">Shop key: </span>
              <code className="rounded bg-surface-muted px-1.5 py-0.5">{issued.storeKey}</code>
            </p>
            <p className="break-all">
              <span className="font-medium">Signing secret: </span>
              <code className="rounded bg-surface-muted px-1.5 py-0.5">{issued.webhookSecret}</code>
            </p>
            <p>
              Store both in your shop now. The key you replaced keeps working for five minutes so
              nothing breaks mid order.
            </p>
            <Button variant="secondary" onClick={() => setIssued(null)}>
              I have stored them
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Shops connected</CardTitle>
          <CardDescription>
            Each shop has its own key, so one can be stopped without touching the others.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.length === 0 ? (
            <EmptyState
              title="No shop is connected yet"
              description="Connect your first shop below. You will get a key and a signing secret to paste into it."
            />
          ) : (
            <ul className="space-y-3">
              {connections.map((connection) => (
                <li
                  key={connection.connectionId}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{connection.storeName}</p>
                      <Badge tone={STATUS_TONES[connection.status] ?? 'neutral'}>
                        {humanise(connection.status)}
                      </Badge>
                      <Badge tone="neutral">{humanise(connection.platform)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{connection.storeDomain}</p>
                    <p className="text-sm text-muted-foreground">
                      {`${formatNumber(connection.orderCount)} orders, ${formatNumber(
                        connection.paidCount
                      )} paid, billed in ${connection.defaultCurrency}.`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {connection.keyMaskedHint === null
                        ? 'No key has been issued yet.'
                        : `Key ending ${connection.keyMaskedHint}, issued ${
                            connection.keyIssuedAt === null
                              ? 'recently'
                              : formatDateTime(connection.keyIssuedAt)
                          }.`}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">
                      {`Notifications from this shop: ${baseUrl}/api/webhooks/storefront/${connection.connectionId}`}
                    </p>
                    {connection.lastError !== null ? (
                      <p className="text-danger text-sm">{connection.lastError}</p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => onEdit(connection)}
                        disabled={busyId === connection.connectionId}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        isLoading={busyId === connection.connectionId}
                        loadingLabel="Issuing"
                        onClick={() => void onIssueKey(connection.connectionId)}
                      >
                        {connection.keyMaskedHint === null ? 'Issue key' : 'Replace key'}
                      </Button>
                      {connection.status === 'active' ? (
                        <Button
                          variant="destructive"
                          disabled={busyId === connection.connectionId}
                          onClick={() => void onSetStatus(connection.connectionId, 'suspended')}
                        >
                          Stop
                        </Button>
                      ) : (
                        <Button
                          disabled={
                            busyId === connection.connectionId ||
                            !isVerified ||
                            connection.keyMaskedHint === null
                          }
                          onClick={() => void onSetStatus(connection.connectionId, 'active')}
                        >
                          Go live
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId === null ? 'Connect a shop' : 'Change this shop'}</CardTitle>
            <CardDescription>
              Orders arriving from this shop become invoices in your account, with the shopper on
              file as a client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
              {failure !== null ? (
                <Alert tone="danger" title="That shop could not be saved">
                  {failure}
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField id="storefront-platform" label="Platform" isRequired>
                  <Select
                    id="storefront-platform"
                    options={PLATFORM_OPTIONS}
                    value={form.platform}
                    onChange={(event) => onChange('platform', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="storefront-name"
                  label="Shop name"
                  hint="Only you see this."
                  errors={fieldErrors['storeName']}
                  isRequired
                >
                  <Input
                    id="storefront-name"
                    value={form.storeName}
                    onChange={(event) => onChange('storeName', event.target.value)}
                    autoComplete="off"
                  />
                </FormField>

                <FormField
                  id="storefront-domain"
                  label="Shop address"
                  hint="The domain your shop runs on, such as shop.example.com."
                  errors={fieldErrors['storeDomain']}
                  isRequired
                >
                  <Input
                    id="storefront-domain"
                    value={form.storeDomain}
                    onChange={(event) => onChange('storeDomain', event.target.value)}
                    autoComplete="off"
                  />
                </FormField>

                <FormField
                  id="storefront-currency"
                  label="Currency"
                  hint="Used when an order does not say."
                  errors={fieldErrors['defaultCurrency']}
                  isRequired
                >
                  <Input
                    id="storefront-currency"
                    value={form.defaultCurrency}
                    maxLength={3}
                    onChange={(event) => onChange('defaultCurrency', event.target.value)}
                    autoComplete="off"
                  />
                </FormField>

                <FormField
                  id="storefront-notify"
                  label="Where we tell your shop about payments"
                  hint="A secure address on your shop. Leave it empty if your shop asks us instead."
                  errors={fieldErrors['notifyUrl']}
                >
                  <Input
                    id="storefront-notify"
                    value={form.notifyUrl}
                    onChange={(event) => onChange('notifyUrl', event.target.value)}
                    autoComplete="off"
                  />
                </FormField>
              </div>

              <Checkbox
                label="Issue the invoice as soon as the order arrives"
                description="Leave this on unless you want to check orders by hand before they are billed."
                checked={form.autoIssueInvoice}
                onChange={(event) => onChange('autoIssueInvoice', event.target.checked)}
              />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                  {editingId === null ? 'Connect shop' : 'Save changes'}
                </Button>
                {editingId !== null ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setForm({
                        platform: 'woocommerce',
                        storeName: '',
                        storeDomain: '',
                        notifyUrl: '',
                        defaultCurrency: currency,
                        autoIssueInvoice: true,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
