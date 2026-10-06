// src/components/projects/project-detail-view.tsx
// One project: what it earned, what it cost, and every hour behind both.
//
// The profitability figures are the reason this page exists. A freelancer
// who only sees revenue will keep taking the work that loses them money.

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { invoiceProjectWork, logTime } from '@/features/projects/actions/manage-projects';
import type {
  MilestoneRow,
  ProjectProfit,
  ProjectSummary,
  TimeEntryRow,
} from '@/features/projects/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface ProjectDetailViewProps {
  /** The project being shown. */
  project: ProjectSummary;
  /** The hours logged against it. */
  entries: readonly TimeEntryRow[];
  /** The milestones agreed on it. */
  milestones: readonly MilestoneRow[];
  /** What it earned and what it cost. */
  profit: ProjectProfit | null;
  /** True when the viewer may log time and raise an invoice. */
  canEdit: boolean;
}

/**
 * Renders one project in full.
 *
 * @param props The project and everything behind it.
 * @returns The rendered page body.
 */
export function ProjectDetailView({
  project,
  entries,
  milestones,
  profit,
  canEdit,
}: ProjectDetailViewProps) {
  const router = useRouter();

  const [minutes, setMinutes] = useState('60');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [isInvoicing, setIsInvoicing] = useState(false);

  /**
   * Writes time against this project.
   *
   * @returns Nothing.
   */
  async function onLog(): Promise<void> {
    setIsLogging(true);

    const result = await logTime({
      projectId: project.projectId,
      minutes,
      description,
      entryDate: entryDate === '' ? undefined : entryDate,
      isBillable: true,
    });

    setIsLogging(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Logged. It is now waiting to be invoiced.');
    setDescription('');
    router.refresh();
  }

  /**
   * Puts everything uninvoiced on a draft invoice.
   *
   * @returns Nothing.
   */
  async function onInvoice(): Promise<void> {
    setIsInvoicing(true);
    const result = await invoiceProjectWork({ projectId: project.projectId });
    setIsInvoicing(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('A draft invoice is waiting for you. Nothing has been sent.');
    router.push(`/dashboard/invoices/${result.data.invoiceId}`);
  }

  const tiles = [
    {
      label: 'Hours logged',
      value: formatNumber(Number(project.loggedHours), 2),
      note: `${formatNumber(Number(project.billableHours), 2)} of them billable`,
    },
    {
      label: 'Waiting to be invoiced',
      value: formatMoney(project.uninvoicedAmount, project.currency),
      note: 'Billable work with no invoice against it yet',
    },
    {
      label: 'Already billed',
      value: formatMoney(project.billedAmount, project.currency),
      note: 'Across every invoice raised from this project',
    },
    {
      label: 'What is left after costs',
      value:
        profit === null
          ? formatMoney('0', project.currency)
          : formatMoney(profit.grossProfit, project.currency),
      note:
        profit === null
          ? 'No cost recorded yet'
          : `${profit.marginPercentage}% margin after labour and expenses`,
    },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="space-y-1 pt-6">
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="tabular text-2xl font-semibold">{tile.value}</dd>
              <p className="text-sm text-muted-foreground">{tile.note}</p>
            </CardContent>
          </Card>
        ))}
      </dl>

      {canEdit && Number.parseFloat(project.uninvoicedAmount) > 0 ? (
        <Alert tone="success" title="There is work here that has not been billed">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {`${formatMoney(project.uninvoicedAmount, project.currency)} of billable work is waiting. It becomes a draft invoice with each entry as its own line.`}
            </span>
            <Button
              variant="secondary"
              isLoading={isInvoicing}
              loadingLabel="Preparing"
              onClick={() => void onInvoice()}
            >
              Raise a draft invoice
            </Button>
          </div>
        </Alert>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Log time you have already worked</CardTitle>
            <CardDescription>
              For the hours that happened away from the clock. Write the description the way your
              client should read it, because it becomes the invoice line.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="log-minutes" label="Minutes" isRequired>
                <Input
                  id="log-minutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </FormField>

              <FormField id="log-date" label="Date" hint="Left empty, today is used.">
                <Input
                  id="log-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </FormField>

              <FormField id="log-description" label="What you did" isRequired>
                <Input
                  id="log-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </FormField>
            </div>

            <Button isLoading={isLogging} loadingLabel="Logging" onClick={() => void onLog()}>
              Log this time
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Every hour on this project</CardTitle>
          <CardDescription>
            Newest first. An entry that has been invoiced can no longer be edited, which is what
            keeps the invoice and the record telling the same story.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState
              title="No time logged yet"
              description="Start the clock from the project list, or write up an hour you have already worked above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>What was done</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead isNumeric>Hours</TableHead>
                  <TableHead isNumeric>Value</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.entryId}>
                    <TableCell>{formatDate(entry.entryDate)}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{entry.personName ?? 'Not recorded'}</TableCell>
                    <TableCell isNumeric>{formatNumber(entry.minutes / 60, 2)}</TableCell>
                    <TableCell isNumeric>
                      {entry.isBillable
                        ? formatMoney(entry.billableAmount, project.currency)
                        : 'Not billable'}
                    </TableCell>
                    <TableCell>
                      {entry.isRunning ? (
                        <Badge tone="warning">Running</Badge>
                      ) : (
                        <Badge tone="neutral">{humanise(entry.status)}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {milestones.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>What was agreed, and what has been reached.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {milestones.map((milestone) => (
                <li
                  key={milestone.milestoneId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{milestone.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {milestone.dueDate === null
                        ? 'No date agreed'
                        : `Due ${formatDate(milestone.dueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular">
                      {formatMoney(milestone.amount, project.currency)}
                    </span>
                    <Badge tone={milestone.isComplete ? 'success' : 'neutral'}>
                      {milestone.isComplete ? 'Reached' : 'Outstanding'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
