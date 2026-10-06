// src/components/messaging/channel-manager.tsx
// Where a business sets up the ways it reaches people besides email: which
// supplier is behind each channel, what a message costs, how many may go in
// a day, and the hours nobody is to be woken up in.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import { saveMessagingChannel } from '@/features/messaging/actions/save-channel';
import { setChannelActive } from '@/features/messaging/actions/set-channel-active';
import { testMessagingChannel } from '@/features/messaging/actions/test-channel';
import type { MessagingChannelRecord } from '@/features/messaging/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ChannelManagerProps {
  /** The channels this business can send on. */
  channels: readonly MessagingChannelRecord[];
  /** False when the viewer may look but not change anything. */
  canManage: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'Chat, number based' },
  { value: 'telegram', label: 'Chat, bot based' },
  { value: 'viber', label: 'Chat, account based' },
];

const PROVIDER_HINT =
  'A short key for the supplier behind this channel, in lower case, such as north_gateway. A supplier nobody has written code for is reached through the configurable adapter.';

/**
 * Renders the channel manager.
 *
 * @param props The channels and what the viewer may do.
 * @returns The rendered manager.
 */
export function ChannelManager({ channels, canManage }: ChannelManagerProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [channel, setChannel] = useState('sms');

  const needsNumber = channel === 'sms' || channel === 'whatsapp' || channel === 'viber';

  /**
   * Saves the channel described by the form.
   *
   * @param event Submission of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (name: string): string => String(form.get(name) ?? '').trim();

    const result = await saveMessagingChannel({
      channel: read('channel'),
      provider: read('provider'),
      displayName: read('displayName'),
      senderNumber: read('senderNumber') || undefined,
      senderHandle: read('senderHandle') || undefined,
      costPerMessage: read('costPerMessage') || 0,
      costCurrency: read('costCurrency') || 'USD',
      dailySendLimit: read('dailySendLimit') || undefined,
      routingPriority: read('routingPriority') || 100,
      quietHoursStart: read('quietHoursStart') || undefined,
      quietHoursEnd: read('quietHoursEnd') || undefined,
      adapterSettings: {
        ...(read('sendUrl') ? { send_url: read('sendUrl') } : {}),
        ...(read('statusUrl') ? { status_url: read('statusUrl') } : {}),
      },
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success('The channel has been saved. Test it before you rely on it.');
    router.refresh();
  }

  /**
   * Tests one channel against its supplier.
   *
   * @param record Channel being tested.
   * @returns Nothing.
   */
  async function onTest(record: MessagingChannelRecord): Promise<void> {
    setBusyId(record.channelId);
    setFailure(null);

    const result = await testMessagingChannel({ channelId: record.channelId });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

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
   * Switches one channel on or off.
   *
   * @param record Channel being switched.
   * @param isActive The state it should end up in.
   * @returns Nothing.
   */
  async function onToggle(record: MessagingChannelRecord, isActive: boolean): Promise<void> {
    setBusyId(record.channelId);
    setFailure(null);

    const result = await setChannelActive({ channelId: record.channelId, isActive });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(isActive ? 'That channel is on again.' : 'That channel has been switched off.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Channels you can send on</CardTitle>
          <CardDescription>
            A channel has to be tested before anything is sent through it, and a channel that is
            switched off keeps its settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {channels.length === 0 ? (
            <EmptyState
              title="Only email is set up so far"
              description="Add a text message or chat channel below and a reminder can follow a client wherever they actually read."
            />
          ) : (
            <ul className="space-y-3">
              {channels.map((record) => (
                <li
                  key={record.channelId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{record.displayName}</p>
                      <Badge tone="neutral">{humanise(record.channel)}</Badge>
                      <Badge tone={record.isVerified ? 'success' : 'warning'}>
                        {record.isVerified ? 'Tested' : 'Not tested yet'}
                      </Badge>
                      {record.isPlatformChannel ? <Badge tone="info">Shared</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {record.senderNumber ?? record.senderHandle ?? 'No sender address'} ·{' '}
                      {formatMoney(record.costPerMessage, record.costCurrency)} a message ·{' '}
                      {record.dailySendLimit === null
                        ? 'no daily limit'
                        : `${formatNumber(record.sentToday)} of ${formatNumber(
                            record.dailySendLimit
                          )} sent today`}
                    </p>
                    {record.quietHoursStart && record.quietHoursEnd ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing is sent between {record.quietHoursStart} and {record.quietHoursEnd}.
                      </p>
                    ) : null}
                    {record.lastUsedAt ? (
                      <p className="text-sm text-muted-foreground">
                        Last used {formatDateTime(record.lastUsedAt)}.
                      </p>
                    ) : null}
                    {record.lastError ? (
                      <p className="text-danger text-sm">{record.lastError}</p>
                    ) : null}
                  </div>

                  {canManage && !record.isPlatformChannel ? (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={record.isActive}
                        label={`Use ${record.displayName}`}
                        disabled={busyId === record.channelId}
                        onCheckedChange={(next) => {
                          void onToggle(record, next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={busyId === record.channelId}
                        loadingLabel="Testing"
                        onClick={() => {
                          void onTest(record);
                        }}
                      >
                        Test connection
                      </Button>
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
            <CardTitle>Add or edit a channel</CardTitle>
            <CardDescription>
              Saving the same channel and supplier again edits what is there rather than adding a
              second one. Keys and tokens are kept encrypted and are never shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit} noValidate>
              <FormField
                id="channel"
                label="Channel"
                hint="How the message travels."
                errors={fieldErrors.channel}
                isRequired
              >
                <Select
                  name="channel"
                  options={CHANNEL_OPTIONS}
                  value={channel}
                  onChange={(event) => {
                    setChannel(event.target.value);
                  }}
                  {...fieldAccessibilityProps('channel', true, Boolean(fieldErrors.channel))}
                />
              </FormField>

              <FormField
                id="provider"
                label="Supplier key"
                hint={PROVIDER_HINT}
                errors={fieldErrors.provider}
                isRequired
              >
                <Input
                  name="provider"
                  defaultValue="configurable"
                  {...fieldAccessibilityProps('provider', true, Boolean(fieldErrors.provider))}
                />
              </FormField>

              <FormField
                id="displayName"
                label="Name for your team"
                errors={fieldErrors.displayName}
                isRequired
              >
                <Input
                  name="displayName"
                  placeholder="Payment reminders"
                  {...fieldAccessibilityProps(
                    'displayName',
                    false,
                    Boolean(fieldErrors.displayName)
                  )}
                />
              </FormField>

              {needsNumber ? (
                <FormField
                  id="senderNumber"
                  label="Sending number"
                  hint="In full, with the country code."
                  errors={fieldErrors.senderNumber}
                  isRequired
                >
                  <Input
                    name="senderNumber"
                    placeholder="+15550100100"
                    {...fieldAccessibilityProps(
                      'senderNumber',
                      true,
                      Boolean(fieldErrors.senderNumber)
                    )}
                  />
                </FormField>
              ) : (
                <FormField
                  id="senderHandle"
                  label="Bot or account name"
                  hint="The name clients will see the message come from."
                  errors={fieldErrors.senderHandle}
                >
                  <Input
                    name="senderHandle"
                    placeholder="billing_bot"
                    {...fieldAccessibilityProps(
                      'senderHandle',
                      true,
                      Boolean(fieldErrors.senderHandle)
                    )}
                  />
                </FormField>
              )}

              <FormField
                id="costPerMessage"
                label="Cost of one message"
                hint="Used to work out what a chain costs before it runs."
                errors={fieldErrors.costPerMessage}
              >
                <Input
                  name="costPerMessage"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue="0"
                  {...fieldAccessibilityProps(
                    'costPerMessage',
                    true,
                    Boolean(fieldErrors.costPerMessage)
                  )}
                />
              </FormField>

              <FormField id="costCurrency" label="Currency" errors={fieldErrors.costCurrency}>
                <Input
                  name="costCurrency"
                  defaultValue="USD"
                  maxLength={3}
                  {...fieldAccessibilityProps(
                    'costCurrency',
                    false,
                    Boolean(fieldErrors.costCurrency)
                  )}
                />
              </FormField>

              <FormField
                id="dailySendLimit"
                label="Most messages in a day"
                hint="Leave empty for no limit."
                errors={fieldErrors.dailySendLimit}
              >
                <Input
                  name="dailySendLimit"
                  type="number"
                  min="1"
                  {...fieldAccessibilityProps(
                    'dailySendLimit',
                    true,
                    Boolean(fieldErrors.dailySendLimit)
                  )}
                />
              </FormField>

              <FormField
                id="routingPriority"
                label="Order among channels"
                hint="A lower number is tried first when a chain does not name a channel."
                errors={fieldErrors.routingPriority}
              >
                <Input
                  name="routingPriority"
                  type="number"
                  min="1"
                  max="1000"
                  defaultValue="100"
                  {...fieldAccessibilityProps(
                    'routingPriority',
                    true,
                    Boolean(fieldErrors.routingPriority)
                  )}
                />
              </FormField>

              <FormField
                id="quietHoursStart"
                label="Quiet from"
                hint="Messages that fall in the quiet period wait until it ends."
                errors={fieldErrors.quietHoursStart}
              >
                <Input
                  name="quietHoursStart"
                  type="time"
                  {...fieldAccessibilityProps(
                    'quietHoursStart',
                    true,
                    Boolean(fieldErrors.quietHoursStart)
                  )}
                />
              </FormField>

              <FormField id="quietHoursEnd" label="Quiet until" errors={fieldErrors.quietHoursEnd}>
                <Input
                  name="quietHoursEnd"
                  type="time"
                  {...fieldAccessibilityProps(
                    'quietHoursEnd',
                    false,
                    Boolean(fieldErrors.quietHoursEnd)
                  )}
                />
              </FormField>

              <FormField
                id="sendUrl"
                label="Sending address"
                hint="Only needed for a supplier reached by configuration."
                errors={fieldErrors.adapterSettings}
              >
                <Input
                  name="sendUrl"
                  type="url"
                  placeholder="https://api.example.com/v1/messages"
                  {...fieldAccessibilityProps('sendUrl', true, false)}
                />
              </FormField>

              <FormField
                id="statusUrl"
                label="Address used for testing"
                hint="Called when you press Test connection."
              >
                <Input
                  name="statusUrl"
                  type="url"
                  placeholder="https://api.example.com/v1/account"
                  {...fieldAccessibilityProps('statusUrl', true, false)}
                />
              </FormField>

              <div className="md:col-span-2">
                <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                  Save channel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert tone="info" title="You are looking, not changing">
          Only the owner of this business can add a channel or switch one off.
        </Alert>
      )}
    </div>
  );
}
