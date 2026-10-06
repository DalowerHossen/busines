// src/components/projects/timesheet-console.tsx
// A week of work, handed in and signed off, and the retainers that work
// is drawn against.
//
// Two rules live on this screen because they are what make hours
// trustworthy. The person who worked them hands them in; somebody else
// approves them. And a retainer shows what is left of the hours a client
// has already paid for, before anybody works the hour that goes over.

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
  buildMyTimesheet,
  closeRetainerPeriod,
  openRetainerPeriod,
  reviewTimesheet,
  saveRetainer,
  submitTimesheet,
} from '@/features/timesheets/actions/manage-timesheets';
import type { RetainerRow, TimesheetRow } from '@/features/timesheets/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface TimesheetConsoleProps {
  /** The weeks of work gathered so far. */
  timesheets: readonly TimesheetRow[];
  /** The retainers running. */
  retainers: readonly RetainerRow[];
  /** Clients a retainer can be agreed with. */
  clients: readonly { id: string; name: string }[];
  /** True when the viewer may approve and run retainers. */
  isOwner: boolean;
  /** Currency this business works in. */
  currency: string;
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

/**
 * Renders the timesheet and retainer console.
 *
 * @param props The weeks, the retainers and who may approve.
 * @returns The rendered console.
 */
export function TimesheetConsole({
  timesheets,
  retainers,
  clients,
  isOwner,
  currency,
}: TimesheetConsoleProps) {
  const router = useRouter();

  const [periodStart, setPeriodStart] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const [retainerName, setRetainerName] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [includedHours, setIncludedHours] = useState('10');
  const [isSavingRetainer, setIsSavingRetainer] = useState(false);

  const waiting = timesheets.filter(
    (sheet) => sheet.status === 'pending' && sheet.submittedAt !== null
  ).length;

  /**
   * Gathers one week of the viewer's own time.
   *
   * @returns Nothing.
   */
  async function onBuild(): Promise<void> {
    setIsBuilding(true);
    const result = await buildMyTimesheet({ periodStart });
    setIsBuilding(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Gathered. Check it, then hand it in.');
    router.refresh();
  }

  /**
   * Hands one week in for approval.
   *
   * @param timesheetId Week being handed in.
   * @returns Nothing.
   */
  async function onSubmit(timesheetId: string): Promise<void> {
    const result = await submitTimesheet({ timesheetId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Handed in. Somebody else approves it from here.');
    router.refresh();
  }

  /**
   * Approves or sends back one week.
   *
   * @param timesheetId Week being reviewed.
   * @param approve True to approve it.
   * @returns Nothing.
   */
  async function onReview(timesheetId: string, approve: boolean): Promise<void> {
    const result = await reviewTimesheet({
      timesheetId,
      approve,
      reason: approve ? undefined : reason,
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(approve ? 'Approved.' : 'Sent back with your note.');
    setRejectingId(null);
    setReason('');
    router.refresh();
  }

  /**
   * Agrees a new retainer with a client.
   *
   * @returns Nothing.
   */
  async function onSaveRetainer(): Promise<void> {
    setIsSavingRetainer(true);

    const result = await saveRetainer({
      clientId,
      name: retainerName,
      amount,
      includedHours,
      billingPeriod: 'monthly',
      rolloverUnusedHours: false,
    });

    setIsSavingRetainer(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Agreed. Open a period when the client starts paying for it.');
    setRetainerName('');
    setAmount('');
    router.refresh();
  }

  /**
   * Opens the next period on a retainer.
   *
   * @param agreementId Retainer being opened.
   * @returns Nothing.
   */
  async function onOpenPeriod(agreementId: string): Promise<void> {
    const result = await openRetainerPeriod({ agreementId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Open. Hours worked now draw against it.');
    router.refresh();
  }

  /**
   * Closes the running period of a retainer.
   *
   * @param periodId Period being closed.
   * @returns Nothing.
   */
  async function onClosePeriod(periodId: string): Promise<void> {
    const result = await closeRetainerPeriod({ periodId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Closed. Anything over the included hours is ready to bill.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {isOwner && waiting > 0 ? (
        <Alert tone="warning" title="Weeks waiting for you">
          {`${formatNumber(waiting)} timesheets have been handed in and nobody has looked at them. Hours cannot be billed until they are approved.`}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your week</CardTitle>
          <CardDescription>
            Gathering a week collects every hour you logged in it. Check it reads the way you want
            your client to read it, then hand it in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <FormField
              id="period-start"
              label="Week beginning"
              hint="The Monday of the week you want to hand in."
              isRequired
            >
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </FormField>

            <Button isLoading={isBuilding} loadingLabel="Gathering" onClick={() => void onBuild()}>
              Gather this week
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weeks of work</CardTitle>
          <CardDescription>
            Handed in by whoever worked them, approved by somebody else. The database insists on
            that, not the screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timesheets.length === 0 ? (
            <EmptyState
              title="No week has been gathered yet"
              description="Gather a week above and every hour you logged in it is pulled together for approval."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead isNumeric>Hours</TableHead>
                  <TableHead isNumeric>Billable</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>What happens next</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((sheet) => (
                  <TableRow key={sheet.timesheetId}>
                    <TableCell>
                      {`${formatDate(sheet.periodStart)} to ${formatDate(sheet.periodEnd)}`}
                    </TableCell>
                    <TableCell>
                      {sheet.isMine ? 'You' : (sheet.personName ?? 'Not recorded')}
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(Number(sheet.totalHours), 2)}</TableCell>
                    <TableCell isNumeric>{formatNumber(Number(sheet.billableHours), 2)}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[sheet.status] ?? 'neutral'}>
                        {humanise(sheet.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sheet.status === 'approved' ? (
                        <span className="text-sm text-muted-foreground">Ready to be invoiced.</span>
                      ) : sheet.submittedAt === null ? (
                        sheet.isMine ? (
                          <Button
                            variant="secondary"
                            onClick={() => void onSubmit(sheet.timesheetId)}
                          >
                            Hand it in
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not handed in yet.</span>
                        )
                      ) : isOwner ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => void onReview(sheet.timesheetId, true)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setRejectingId(
                                rejectingId === sheet.timesheetId ? null : sheet.timesheetId
                              )
                            }
                          >
                            Send back
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Waiting for approval.</span>
                      )}

                      {rejectingId === sheet.timesheetId ? (
                        <div className="mt-2 space-y-2">
                          <FormField
                            id={`reason-${sheet.timesheetId}`}
                            label="What needs fixing"
                            isRequired
                          >
                            <Input
                              id={`reason-${sheet.timesheetId}`}
                              value={reason}
                              onChange={(event) => setReason(event.target.value)}
                            />
                          </FormField>
                          <Button onClick={() => void onReview(sheet.timesheetId, false)}>
                            Send it back
                          </Button>
                        </div>
                      ) : null}

                      {sheet.rejectionReason === null ? null : (
                        <p className="text-danger mt-1 text-sm">{sheet.rejectionReason}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retainers</CardTitle>
          <CardDescription>
            Hours a client has already paid for. What is left is shown before anybody works the hour
            that goes over it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {retainers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retainer is agreed yet.</p>
          ) : (
            <ul className="space-y-3">
              {retainers.map((retainer) => (
                <li
                  key={retainer.agreementId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{retainer.name}</p>
                      <Badge tone={retainer.status === 'active' ? 'success' : 'neutral'}>
                        {humanise(retainer.status)}
                      </Badge>
                      {Number(retainer.overageHours) > 0 ? (
                        <Badge tone="warning">
                          {`${formatNumber(Number(retainer.overageHours), 2)} hours over`}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="tabular text-sm text-muted-foreground">
                      {`${formatMoney(retainer.amount, retainer.currency)} ${humanise(
                        retainer.billingPeriod
                      ).toLowerCase()} for ${formatNumber(Number(retainer.includedHours), 2)} hours${
                        retainer.clientName === null ? '' : `, for ${retainer.clientName}`
                      }`}
                    </p>

                    <p className="tabular text-sm text-muted-foreground">
                      {retainer.currentPeriodId === null
                        ? 'No period is running.'
                        : `${formatNumber(Number(retainer.usedHours), 2)} used, ${formatNumber(
                            Number(retainer.remainingHours),
                            2
                          )} left${
                            retainer.periodEnd === null
                              ? ''
                              : `, period ends ${formatDate(retainer.periodEnd)}`
                          }`}
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="flex flex-wrap gap-2">
                      {retainer.currentPeriodId === null ? (
                        <Button
                          variant="secondary"
                          onClick={() => void onOpenPeriod(retainer.agreementId)}
                        >
                          Open a period
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => void onClosePeriod(retainer.currentPeriodId ?? '')}
                        >
                          Close this period
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isOwner && clients.length > 0 ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <FormField id="retainer-name" label="Name" isRequired>
                <Input
                  id="retainer-name"
                  value={retainerName}
                  onChange={(event) => setRetainerName(event.target.value)}
                />
              </FormField>

              <FormField id="retainer-client" label="Client" isRequired>
                <Select
                  id="retainer-client"
                  value={clientId}
                  options={clients.map((client) => ({ value: client.id, label: client.name }))}
                  onChange={(event) => setClientId(event.target.value)}
                />
              </FormField>

              <FormField id="retainer-amount" label={`Monthly fee (${currency})`} isRequired>
                <Input
                  id="retainer-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>

              <FormField id="retainer-hours" label="Hours included" isRequired>
                <Input
                  id="retainer-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={includedHours}
                  onChange={(event) => setIncludedHours(event.target.value)}
                />
              </FormField>

              <div className="sm:col-span-4">
                <Button
                  variant="secondary"
                  isLoading={isSavingRetainer}
                  loadingLabel="Saving"
                  onClick={() => void onSaveRetainer()}
                >
                  Agree this retainer
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
