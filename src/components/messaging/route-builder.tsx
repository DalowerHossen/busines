// src/components/messaging/route-builder.tsx
// Laying out the order a reminder travels in: email first, then a text
// message a day later, then a chat message. The chain stops the moment one
// of them lands, so a client who read the email is never also texted.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { saveMessageRoute } from '@/features/messaging/actions/save-route';
import { setMessageRouteSteps } from '@/features/messaging/actions/set-route-steps';
import type { MessageRouteRecord } from '@/features/messaging/types';
import { formatNumber, humanise } from '@/lib/format';

export interface RouteBuilderProps {
  /** The chains this business can use. */
  routes: readonly MessageRouteRecord[];
  /** False when the viewer may look but not change anything. */
  canManage: boolean;
}

const STEP_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'Chat, number based' },
  { value: 'telegram', label: 'Chat, bot based' },
  { value: 'viber', label: 'Chat, account based' },
];

interface DraftStep {
  channel: string;
  waitMinutes: number;
}

/**
 * Describes one step in a sentence rather than a row of fields.
 *
 * @param channel Channel being tried.
 * @param waitMinutes How long it is given.
 * @returns The sentence.
 */
function describeStep(channel: string, waitMinutes: number): string {
  const hours = Math.round(waitMinutes / 60);
  const waited =
    waitMinutes === 0
      ? 'then straight on to the next channel'
      : hours >= 1
        ? `then wait ${formatNumber(hours)} hour${hours === 1 ? '' : 's'}`
        : `then wait ${formatNumber(waitMinutes)} minutes`;

  return `${humanise(channel)}, ${waited}`;
}

/**
 * Renders the chain builder.
 *
 * @param props The chains and what the viewer may do.
 * @returns The rendered builder.
 */
export function RouteBuilder({ routes, canManage }: RouteBuilderProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftStep[]>>({});

  /**
   * Reads the chain being edited, falling back to what is stored.
   *
   * @param route Chain being edited.
   * @returns The steps currently on screen.
   */
  function stepsOf(route: MessageRouteRecord): DraftStep[] {
    return (
      drafts[route.routeId] ??
      route.steps.map((step) => ({ channel: step.channel, waitMinutes: step.waitMinutes }))
    );
  }

  /**
   * Creates a new chain from the form.
   *
   * @param event Submission of the form.
   * @returns Nothing.
   */
  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (name: string): string => String(form.get(name) ?? '').trim();

    const result = await saveMessageRoute({
      routeKey: read('routeKey'),
      name: read('name'),
      description: read('description') || undefined,
      isActive: true,
      stopOnDelivery: form.get('stopOnDelivery') !== null,
      stopOnEngagement: form.get('stopOnEngagement') !== null,
      respectQuietHours: form.get('respectQuietHours') !== null,
      requiresConsent: form.get('requiresConsent') !== null,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success('The chain has been saved. Now choose the channels it tries.');
    router.refresh();
  }

  /**
   * Stores the order of one chain.
   *
   * @param route Chain being saved.
   * @returns Nothing.
   */
  async function onSaveSteps(route: MessageRouteRecord): Promise<void> {
    setBusyId(route.routeId);
    setFailure(null);

    const result = await setMessageRouteSteps({
      routeId: route.routeId,
      steps: stepsOf(route).map((step) => ({
        channel: step.channel,
        waitMinutes: step.waitMinutes,
        isRequired: false,
      })),
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`That chain now tries ${formatNumber(result.data.stepCount)} channels.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      {routes.length === 0 ? (
        <EmptyState
          title="No fallback chains yet"
          description="A chain is how a reminder follows a client from one channel to the next until one of them lands."
        />
      ) : (
        routes.map((route) => {
          const steps = stepsOf(route);

          return (
            <Card key={route.routeId}>
              <CardHeader>
                <CardTitle>{route.name}</CardTitle>
                <CardDescription>
                  {route.description ??
                    'Each channel is given its turn, and the chain stops as soon as one of them works.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={route.isActive ? 'success' : 'neutral'}>
                    {route.isActive ? 'In use' : 'Switched off'}
                  </Badge>
                  {route.isPlatformRoute ? <Badge tone="info">Shared</Badge> : null}
                  {route.requiresConsent ? <Badge tone="neutral">Consent required</Badge> : null}
                  {route.respectQuietHours ? <Badge tone="neutral">Quiet hours kept</Badge> : null}
                  <Badge tone="neutral">{formatNumber(route.runningCount)} running now</Badge>
                </div>

                <ol className="space-y-2">
                  {steps.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      This chain has no channels in it yet, so nothing would be sent.
                    </li>
                  ) : (
                    steps.map((step, index) => (
                      <li
                        key={`${route.routeId}-${step.channel}`}
                        className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
                      >
                        <span className="text-sm font-medium">Step {index + 1}</span>

                        {canManage && !route.isPlatformRoute ? (
                          <>
                            <Select
                              aria-label={`Channel for step ${index + 1}`}
                              options={STEP_CHANNELS}
                              value={step.channel}
                              onChange={(event) => {
                                const next = [...steps];
                                next[index] = { ...step, channel: event.target.value };
                                setDrafts((state) => ({ ...state, [route.routeId]: next }));
                              }}
                            />
                            <Input
                              aria-label={`Minutes to wait after step ${index + 1}`}
                              type="number"
                              min="0"
                              max="20160"
                              className="w-32"
                              value={String(step.waitMinutes)}
                              onChange={(event) => {
                                const next = [...steps];
                                next[index] = {
                                  ...step,
                                  waitMinutes: Number(event.target.value || 0),
                                };
                                setDrafts((state) => ({ ...state, [route.routeId]: next }));
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDrafts((state) => ({
                                  ...state,
                                  [route.routeId]: steps.filter((_, at) => at !== index),
                                }));
                              }}
                            >
                              Remove
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {describeStep(step.channel, step.waitMinutes)}
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ol>

                {canManage && !route.isPlatformRoute ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const used = new Set(steps.map((step) => step.channel));
                        const spare = STEP_CHANNELS.find((option) => !used.has(option.value));

                        if (!spare) {
                          notify.error('Every channel is already in this chain.');

                          return;
                        }

                        setDrafts((state) => ({
                          ...state,
                          [route.routeId]: [...steps, { channel: spare.value, waitMinutes: 60 }],
                        }));
                      }}
                    >
                      Add a channel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      isLoading={busyId === route.routeId}
                      loadingLabel="Saving"
                      onClick={() => {
                        void onSaveSteps(route);
                      }}
                    >
                      Save this order
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Start a new chain</CardTitle>
            <CardDescription>
              Give it a key your own reminders can refer to, and decide when it should stop.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate} noValidate>
              <FormField
                id="routeKey"
                label="Key"
                hint="Lower case letters, numbers and underscores, such as invoice_overdue."
                errors={fieldErrors.routeKey}
                isRequired
              >
                <Input
                  name="routeKey"
                  placeholder="invoice_overdue"
                  {...fieldAccessibilityProps('routeKey', true, Boolean(fieldErrors.routeKey))}
                />
              </FormField>

              <FormField id="name" label="Name" errors={fieldErrors.name} isRequired>
                <Input
                  name="name"
                  placeholder="Chase an overdue invoice"
                  {...fieldAccessibilityProps('name', false, Boolean(fieldErrors.name))}
                />
              </FormField>

              <FormField
                id="description"
                label="What it is for"
                errors={fieldErrors.description}
                hint="Written for whoever reads this page in a year."
              >
                <Input
                  name="description"
                  {...fieldAccessibilityProps(
                    'description',
                    true,
                    Boolean(fieldErrors.description)
                  )}
                />
              </FormField>

              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium">When the chain should stop</legend>
                <Checkbox
                  name="stopOnDelivery"
                  defaultChecked
                  label="Stop once a message is confirmed delivered"
                  description="The usual setting. Nothing else is sent about the same thing."
                />
                <Checkbox
                  name="stopOnEngagement"
                  defaultChecked
                  label="Stop once the client opens or replies"
                  description="Stronger proof than delivery, and worth acting on at once."
                />
                <Checkbox
                  name="respectQuietHours"
                  defaultChecked
                  label="Keep to the quiet hours set on each channel"
                  description="A message that falls in the quiet period waits rather than being dropped."
                />
                <Checkbox
                  name="requiresConsent"
                  defaultChecked
                  label="Only use a channel the client agreed to"
                  description="Leave this on unless you have advice of your own saying otherwise."
                />
              </fieldset>

              <div className="md:col-span-2">
                <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                  Save chain
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert tone="info" title="You are looking, not changing">
          Only the owner of this business can change how reminders travel.
        </Alert>
      )}
    </div>
  );
}
