// src/components/invoices/collections-console.tsx
// Asking for money that is late, without becoming the business nobody
// wants to hear from.
//
// Two things are deliberately prominent. The time zone, because a reminder
// that arrives at two in the morning does more damage than the late payment
// it is chasing. And the promise to pay, because a client who has said when
// they will pay should not then be chased as though they said nothing.

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
  removeReminderRule,
  saveCollectionsSettings,
  saveReminderRule,
} from '@/features/collections/actions/manage-collections';
import type { CollectionsSummary, PromiseRow, ReminderRuleRow } from '@/features/collections/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface CollectionsConsoleProps {
  /** What is owed and how this business chases. */
  summary: CollectionsSummary;
  /** The reminders set up. */
  rules: readonly ReminderRuleRow[];
  /** What clients have promised. */
  promises: readonly PromiseRow[];
  /** True when the viewer may change the rules. */
  isOwner: boolean;
  /** Currency this business works in. */
  currency: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

/**
 * Describes when one reminder goes out.
 *
 * @param offsetDays Days from the due date.
 * @returns The description in plain words.
 */
function describeTiming(offsetDays: number): string {
  if (offsetDays === 0) {
    return 'On the day it is due';
  }

  return offsetDays < 0
    ? `${formatNumber(Math.abs(offsetDays))} days before it is due`
    : `${formatNumber(offsetDays)} days after it was due`;
}

/**
 * Renders the collections console.
 *
 * @param props What is owed, the reminders and the promises.
 * @returns The rendered console.
 */
export function CollectionsConsole({
  summary,
  rules,
  promises,
  isOwner,
  currency,
}: CollectionsConsoleProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [offsetDays, setOffsetDays] = useState('7');
  const [maxReminders, setMaxReminders] = useState('3');
  const [skipIfPromised, setSkipIfPromised] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [isEnabled, setIsEnabled] = useState(summary.isEnabled);
  const [timeZone, setTimeZone] = useState(summary.timeZone);
  const [quietStart, setQuietStart] = useState(summary.quietHoursStart);
  const [quietEnd, setQuietEnd] = useState(summary.quietHoursEnd);
  const [weekdays, setWeekdays] = useState<number[]>([...summary.sendingWeekdays]);
  const [sendStatements, setSendStatements] = useState(summary.sendStatements);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  /**
   * Saves one reminder.
   *
   * @returns Nothing.
   */
  async function onSaveRule(): Promise<void> {
    setIsSavingRule(true);
    setFieldErrors({});

    const result = await saveReminderRule({
      name,
      offsetDays,
      minimumBalance: '0',
      maxReminders,
      skipIfPromiseToPay: skipIfPromised,
      isActive: true,
    });

    setIsSavingRule(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved. It applies to invoices from now on.');
    setName('');
    router.refresh();
  }

  /**
   * Retires one reminder.
   *
   * @param ruleId Reminder being retired.
   * @returns Nothing.
   */
  async function onRemoveRule(ruleId: string): Promise<void> {
    const result = await removeReminderRule({ ruleId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Retired. Nothing already scheduled is cancelled by this.');
    router.refresh();
  }

  /**
   * Saves when this business is willing to chase.
   *
   * @returns Nothing.
   */
  async function onSaveSettings(): Promise<void> {
    setIsSavingSettings(true);

    const result = await saveCollectionsSettings({
      isEnabled,
      timeZone,
      quietHoursStart: quietStart,
      quietHoursEnd: quietEnd,
      sendingWeekdays: weekdays,
      shiftDueDatesToBusinessDays: false,
      sendStatements,
      statementDayOfMonth: sendStatements ? 1 : undefined,
    });

    setIsSavingSettings(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Saved. Reminders are timed in that zone from now on.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Late</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(summary.overdueAmount, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">
              {`Across ${formatNumber(summary.overdueCount)} invoices`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Due within a week</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(summary.dueWithinAWeek, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">Not late yet.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Promised to you</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(summary.promisedAmount, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">
              Clients who have said when they will pay.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Reminders queued</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatNumber(summary.scheduledReminders)}
            </dd>
            <p className="text-sm text-muted-foreground">Waiting for their moment.</p>
          </CardContent>
        </Card>
      </dl>

      {summary.isEnabled ? null : (
        <Alert tone="warning" title="Reminders are switched off">
          Nothing is being sent, however the rules below are set. Invoices still fall due.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>When you are willing to chase</CardTitle>
          <CardDescription>
            Reminders are timed in this zone and never land inside your quiet hours. A message at
            two in the morning costs more goodwill than the late payment is worth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="collections-zone"
              label="Time zone to send in"
              hint="Use the zone your clients live in, not the one you work in."
              isRequired
            >
              <Input
                id="collections-zone"
                value={timeZone}
                disabled={!isOwner}
                onChange={(event) => setTimeZone(event.target.value)}
              />
            </FormField>

            <FormField id="collections-quiet-start" label="Quiet from">
              <Input
                id="collections-quiet-start"
                type="time"
                value={quietStart}
                disabled={!isOwner}
                onChange={(event) => setQuietStart(event.target.value)}
              />
            </FormField>

            <FormField id="collections-quiet-end" label="Quiet until">
              <Input
                id="collections-quiet-end"
                type="time"
                value={quietEnd}
                disabled={!isOwner}
                onChange={(event) => setQuietEnd(event.target.value)}
              />
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Days reminders may go out
            </legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <Checkbox
                  key={day.value}
                  id={`weekday-${String(day.value)}`}
                  label={day.label}
                  checked={weekdays.includes(day.value)}
                  disabled={!isOwner}
                  onChange={(event) => {
                    setWeekdays(
                      event.target.checked
                        ? [...weekdays, day.value]
                        : weekdays.filter((entry) => entry !== day.value)
                    );
                  }}
                />
              ))}
            </div>
          </fieldset>

          <Checkbox
            id="collections-enabled"
            label="Send reminders at all"
            description="Off stops every reminder without deleting the rules you have written."
            checked={isEnabled}
            disabled={!isOwner}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />

          <Checkbox
            id="collections-statements"
            label="Send a monthly statement to clients who owe you"
            description="One summary on the first of the month instead of a reminder per invoice."
            checked={sendStatements}
            disabled={!isOwner}
            onChange={(event) => setSendStatements(event.target.checked)}
          />

          {isOwner ? (
            <Button
              isLoading={isSavingSettings}
              loadingLabel="Saving"
              onClick={() => void onSaveSettings()}
            >
              Save when I chase
            </Button>
          ) : (
            <Alert tone="info" title="This is the owner's decision">
              Ask the owner of this business to change how clients are chased.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your reminders</CardTitle>
          <CardDescription>
            Each one is timed from the due date. A client who has promised to pay is skipped if you
            ask for that.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reminder is set up, so nothing is chased automatically.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reminder</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead isNumeric>At most</TableHead>
                  <TableHead>Promise skips it</TableHead>
                  <TableHead isNumeric>Queued</TableHead>
                  <TableHead isNumeric>Sent</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.ruleId}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{describeTiming(rule.offsetDays)}</TableCell>
                    <TableCell isNumeric>{formatNumber(rule.maxReminders)}</TableCell>
                    <TableCell>{rule.skipIfPromiseToPay ? 'Yes' : 'No'}</TableCell>
                    <TableCell isNumeric>{formatNumber(rule.scheduledCount)}</TableCell>
                    <TableCell isNumeric>{formatNumber(rule.sentCount)}</TableCell>
                    <TableCell>
                      {rule.isActive ? (
                        isOwner ? (
                          <Button variant="ghost" onClick={() => void onRemoveRule(rule.ruleId)}>
                            Retire it
                          </Button>
                        ) : (
                          <Badge tone="success">Active</Badge>
                        )
                      ) : (
                        <Badge tone="neutral">Retired</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {isOwner ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <FormField id="rule-name" label="Name" errors={fieldErrors['name']} isRequired>
                <Input
                  id="rule-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>

              <FormField
                id="rule-offset"
                label="Days from the due date"
                hint="Use a negative number to remind before it is due."
                errors={fieldErrors['offsetDays']}
              >
                <Input
                  id="rule-offset"
                  type="number"
                  min="-60"
                  max="180"
                  value={offsetDays}
                  onChange={(event) => setOffsetDays(event.target.value)}
                />
              </FormField>

              <FormField id="rule-max" label="At most this many times">
                <Input
                  id="rule-max"
                  type="number"
                  min="1"
                  max="8"
                  value={maxReminders}
                  onChange={(event) => setMaxReminders(event.target.value)}
                />
              </FormField>

              <div className="flex items-end">
                <Checkbox
                  id="rule-skip"
                  label="Skip if they promised to pay"
                  checked={skipIfPromised}
                  onChange={(event) => setSkipIfPromised(event.target.checked)}
                />
              </div>

              <div className="sm:col-span-4">
                <Button
                  variant="secondary"
                  isLoading={isSavingRule}
                  loadingLabel="Saving"
                  onClick={() => void onSaveRule()}
                >
                  Add this reminder
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promises to pay</CardTitle>
          <CardDescription>
            A client who has told you when they will pay is not chased again until that day passes.
            A broken promise is worth a telephone call rather than another email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {promises.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has promised a date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Promised for</TableHead>
                  <TableHead isNumeric>Still owed</TableHead>
                  <TableHead>What they said</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promises.map((promise) => (
                  <TableRow key={promise.promiseId}>
                    <TableCell>{promise.clientName ?? 'Not recorded'}</TableCell>
                    <TableCell>{promise.invoiceNumber ?? 'Draft'}</TableCell>
                    <TableCell>{formatDate(promise.promisedDate)}</TableCell>
                    <TableCell isNumeric>{formatMoney(promise.balanceDue, currency)}</TableCell>
                    <TableCell>{promise.note ?? 'Nothing noted'}</TableCell>
                    <TableCell>
                      <Badge tone={promise.isLate ? 'danger' : 'success'}>
                        {promise.isLate ? 'Date has passed' : 'Waiting'}
                      </Badge>
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
