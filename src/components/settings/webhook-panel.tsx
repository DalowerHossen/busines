// src/components/settings/webhook-panel.tsx
// Telling your own software what happened here.
//
// The signing secret is shown exactly once, when the endpoint is created,
// and never again. That is deliberate: a secret a screen can show you is a
// secret anybody with your screen can take. From then on only a fingerprint
// is visible, which is enough to tell two endpoints apart.

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import {
  removeWebhookEndpoint,
  replayWebhookDelivery,
  saveWebhookEndpoint,
  setWebhookEndpointState,
} from '@/features/webhooks/actions/manage-endpoints';
import type { WebhookDeliveryRow, WebhookEndpointRow } from '@/features/webhooks/types';
import { WEBHOOK_EVENTS } from '@/features/webhooks/validation/webhook';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface WebhookPanelProps {
  /** Where this business sends its events. */
  endpoints: readonly WebhookEndpointRow[];
  /** What happened to the recent ones. */
  deliveries: readonly WebhookDeliveryRow[];
  /** True when the viewer may change any of it. */
  isOwner: boolean;
}

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  delivered: 'success',
  pending: 'warning',
  failed: 'danger',
  dead_lettered: 'danger',
};

/**
 * Renders the outbound webhook panel.
 *
 * @param props The endpoints, the deliveries and who may change them.
 * @returns The rendered panel.
 */
export function WebhookPanel({ endpoints, deliveries, isOwner }: WebhookPanelProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['invoice.paid']);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [newSecret, setNewSecret] = useState<string | null>(null);

  /**
   * Creates an endpoint and shows its secret once.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveWebhookEndpoint({
      name,
      targetUrl,
      subscribedEvents: events,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    setNewSecret(result.data.signingSecret);
    setName('');
    setTargetUrl('');
    notify.success('Created. Copy the signing secret now; it is not shown again.');
    router.refresh();
  }

  /**
   * Switches one endpoint on or off.
   *
   * @param endpointId Endpoint being switched.
   * @param isActive True to switch it on.
   * @returns Nothing.
   */
  async function onToggle(endpointId: string, isActive: boolean): Promise<void> {
    const result = await setWebhookEndpointState({ endpointId, isActive });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(isActive ? 'Switched on.' : 'Switched off. Nothing more is sent there.');
    router.refresh();
  }

  /**
   * Removes one endpoint.
   *
   * @param endpointId Endpoint being removed.
   * @returns Nothing.
   */
  async function onRemove(endpointId: string): Promise<void> {
    const result = await removeWebhookEndpoint({ endpointId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Removed. The delivery history is kept.');
    router.refresh();
  }

  /**
   * Sends one delivery again.
   *
   * @param deliveryId Delivery being replayed.
   * @returns Nothing.
   */
  async function onReplay(deliveryId: string): Promise<void> {
    const result = await replayWebhookDelivery({ deliveryId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Queued. It goes out on the next run.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {newSecret === null ? null : (
        <Alert tone="success" title="Your signing secret, shown once">
          <p className="break-all font-mono text-sm">{newSecret}</p>
          <p className="mt-2 text-sm">
            Store it in your own software now. Every event we send carries a signature made with it,
            which is how your software knows the event really came from us. We cannot show it to you
            again.
          </p>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Send events to your own software</CardTitle>
          <CardDescription>
            We post a signed message to an address of yours whenever something happens here. A
            delivery that fails is retried with a growing gap, and anything that never succeeds is
            kept so you can send it again.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isOwner ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="endpoint-name" label="Name" errors={fieldErrors['name']} isRequired>
                  <Input
                    id="endpoint-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormField>

                <FormField
                  id="endpoint-url"
                  label="Where to post"
                  hint="A secure public address. An address inside a private network is refused."
                  errors={fieldErrors['targetUrl']}
                  isRequired
                >
                  <Input
                    id="endpoint-url"
                    type="url"
                    value={targetUrl}
                    onChange={(event) => setTargetUrl(event.target.value)}
                  />
                </FormField>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  What you want to be told about
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {WEBHOOK_EVENTS.map((entry) => (
                    <Checkbox
                      key={entry}
                      id={`event-${entry}`}
                      label={entry}
                      checked={events.includes(entry)}
                      onChange={(changed) => {
                        setEvents(
                          changed.target.checked
                            ? [...events, entry]
                            : events.filter((existing) => existing !== entry)
                        );
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <Button isLoading={isSaving} loadingLabel="Creating" onClick={() => void onSave()}>
                Create this endpoint
              </Button>
            </>
          ) : (
            <Alert tone="info" title="Only the owner may set this up">
              Sending the data of this business to another system is the owner&apos;s decision.
            </Alert>
          )}
        </CardContent>
      </Card>

      {endpoints.length === 0 ? (
        <EmptyState
          title="Nothing is sent anywhere yet"
          description="Add an endpoint above and your own software is told the moment an invoice is paid."
        />
      ) : (
        <ul className="space-y-3">
          {endpoints.map((endpoint) => (
            <li key={endpoint.endpointId} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{endpoint.name}</p>
                    <Badge tone={endpoint.isActive ? 'success' : 'neutral'}>
                      {endpoint.isActive ? 'Live' : 'Off'}
                    </Badge>
                    {endpoint.deadLetterCount > 0 ? (
                      <Badge tone="danger">
                        {`${formatNumber(endpoint.deadLetterCount)} gave up`}
                      </Badge>
                    ) : null}
                    {endpoint.pendingCount > 0 ? (
                      <Badge tone="warning">
                        {`${formatNumber(endpoint.pendingCount)} waiting`}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="break-all text-sm text-muted-foreground">{endpoint.targetUrl}</p>

                  <p className="text-sm text-muted-foreground">
                    {`${endpoint.subscribedEvents.join(', ')}`}
                  </p>

                  <p className="tabular text-sm text-muted-foreground">
                    {`Secret ${endpoint.secretFingerprint}, version ${formatNumber(
                      endpoint.secretKeyVersion
                    )}. ${
                      endpoint.lastSuccessAt === null
                        ? 'Never delivered yet.'
                        : `Last worked ${formatDateTime(endpoint.lastSuccessAt)}.`
                    }`}
                  </p>

                  {endpoint.disabledReason === null ? null : (
                    <p className="text-danger text-sm">{endpoint.disabledReason}</p>
                  )}
                </div>

                {isOwner ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void onToggle(endpoint.endpointId, !endpoint.isActive)}
                    >
                      {endpoint.isActive ? 'Switch off' : 'Switch on'}
                    </Button>
                    <Button variant="ghost" onClick={() => void onRemove(endpoint.endpointId)}>
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent deliveries</CardTitle>
          <CardDescription>
            What was sent, what answered, and what is waiting to be tried again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead isNumeric>Attempts</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.deliveryId}>
                    <TableCell>{formatDateTime(delivery.createdAt)}</TableCell>
                    <TableCell>{delivery.eventType ?? 'Unknown'}</TableCell>
                    <TableCell>{delivery.endpointName}</TableCell>
                    <TableCell isNumeric>{formatNumber(delivery.attemptCount)}</TableCell>
                    <TableCell>
                      {delivery.lastStatusCode === null
                        ? (delivery.lastError ?? 'No answer yet')
                        : formatNumber(delivery.lastStatusCode)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge tone={STATUS_TONES[delivery.status] ?? 'neutral'}>
                          {humanise(delivery.status)}
                        </Badge>

                        {isOwner && delivery.deadLetteredAt !== null ? (
                          <Button
                            variant="ghost"
                            onClick={() => void onReplay(delivery.deliveryId)}
                          >
                            Send it again
                          </Button>
                        ) : null}
                      </div>
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
