// src/components/invoices/bulk-chase-panel.tsx
// Chasing several unpaid invoices in one go.
//
// Each client still receives their own message about their own invoice,
// with their own link. The batch exists so an owner with forty overdue
// invoices does not have to press send forty times, which is the point at
// which most people stop chasing at all.
//
// Two things are deliberate. Only the owner can send, because this reaches
// real clients under the name of the business. And the result names every
// invoice that was skipped and why, rather than reporting a cheerful total
// that hides four failures.

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { recordPaymentPromise } from '@/features/collections/actions/manage-collections';
import { sendReminders, type ReminderFailure } from '@/features/messaging/actions/send-reminders';
import type { ChaseableInvoice } from '@/features/collections/queries/list-chaseable';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface BulkChasePanelProps {
  /** The invoices that could be chased today. */
  invoices: readonly ChaseableInvoice[];
  /** True when the viewer may send to clients. */
  isOwner: boolean;
}

/**
 * Renders the bulk chase panel.
 *
 * @param props The invoices and whether the viewer may send.
 * @returns The rendered panel.
 */
export function BulkChasePanel({ invoices, isOwner }: BulkChasePanelProps) {
  const router = useRouter();

  const [chosen, setChosen] = useState<string[]>([]);
  const [templateKey, setTemplateKey] = useState<'invoice_reminder' | 'invoice_overdue'>(
    'invoice_reminder'
  );
  const [isSending, setIsSending] = useState(false);
  const [promisingId, setPromisingId] = useState<string | null>(null);
  const [promisedDate, setPromisedDate] = useState('');
  const [failures, setFailures] = useState<readonly ReminderFailure[]>([]);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const sendable = invoices.filter((invoice) => invoice.clientEmail !== null);
  const unreachable = invoices.length - sendable.length;

  const chosenTotal = invoices
    .filter((invoice) => chosen.includes(invoice.invoiceId))
    .reduce((running, invoice) => running + Number.parseFloat(invoice.balanceDue), 0);

  /**
   * Sends a reminder for every chosen invoice.
   *
   * @returns Nothing.
   */
  async function onSend(): Promise<void> {
    setIsSending(true);
    setFailures([]);
    setSentCount(null);

    const result = await sendReminders({ invoiceIds: chosen, templateKey });

    setIsSending(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    setSentCount(result.data.sentCount);
    setFailures(result.data.failures);
    setChosen([]);

    if (result.data.failures.length === 0) {
      notify.success(`${formatNumber(result.data.sentCount)} reminders are on their way.`);
    } else {
      notify.success(
        `${formatNumber(result.data.sentCount)} sent, ${formatNumber(result.data.failures.length)} skipped. The reasons are listed below.`
      );
    }

    router.refresh();
  }

  /**
   * Records that a client has said when they will pay.
   *
   * A client who has given a date should not then be chased as though they
   * said nothing, so this is here beside the chasing rather than buried in
   * a settings page.
   *
   * @param invoiceId Invoice the promise is about.
   * @returns Nothing.
   */
  async function onPromise(invoiceId: string): Promise<void> {
    const result = await recordPaymentPromise({
      invoiceId,
      promisedDate,
      note: 'Recorded while chasing unpaid invoices.',
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Noted. They will not be chased again until that day passes.');
    setPromisingId(null);
    setPromisedDate('');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chase several at once</CardTitle>
        <CardDescription>
          Every client gets their own message about their own invoice, with their own payment link.
          Nothing is sent to anybody twice in the same run.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {sentCount === null ? null : (
          <Alert
            tone={failures.length === 0 ? 'success' : 'warning'}
            title={`${formatNumber(sentCount)} reminders queued`}
          >
            {failures.length === 0 ? (
              'Every invoice you chose has been written to.'
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {failures.map((failure) => (
                  <li key={`${failure.invoiceNumber}-${failure.reason}`}>
                    {`${failure.invoiceNumber}: ${failure.reason}`}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {unreachable > 0 ? (
          <Alert tone="warning" title="Some clients have no email address">
            {`${formatNumber(unreachable)} unpaid invoices belong to clients with nothing to write to. Add an address on the client and they appear here.`}
          </Alert>
        ) : null}

        {sendable.length === 0 ? (
          <EmptyState
            title="Nothing to chase"
            description="Every issued invoice has either been paid or belongs to a client with no email address."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chase</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead isNumeric>Outstanding</TableHead>
                  <TableHead>Last chased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendable.map((invoice) => (
                  <TableRow key={invoice.invoiceId}>
                    <TableCell>
                      <Checkbox
                        id={`chase-${invoice.invoiceId}`}
                        label={`Chase ${invoice.invoiceNumber}`}
                        checked={chosen.includes(invoice.invoiceId)}
                        disabled={!isOwner}
                        onChange={(event) => {
                          setChosen(
                            event.target.checked
                              ? [...chosen, invoice.invoiceId]
                              : chosen.filter((id) => id !== invoice.invoiceId)
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.clientName ?? 'Not recorded'}</TableCell>
                    <TableCell>
                      {formatDate(invoice.dueDate)}
                      {invoice.daysOverdue > 0 ? (
                        <Badge tone="warning">
                          {`${formatNumber(invoice.daysOverdue)} days late`}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(invoice.balanceDue, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <span>
                          {invoice.lastChasedAt === null
                            ? 'Never'
                            : formatDate(invoice.lastChasedAt)}
                        </span>

                        {isOwner ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setPromisingId(
                                promisingId === invoice.invoiceId ? null : invoice.invoiceId
                              )
                            }
                          >
                            {promisingId === invoice.invoiceId ? 'Close' : 'They promised a date'}
                          </Button>
                        ) : null}

                        {promisingId === invoice.invoiceId ? (
                          <div className="space-y-2">
                            <FormField id={`promise-${invoice.invoiceId}`} label="They will pay on">
                              <Input
                                id={`promise-${invoice.invoiceId}`}
                                type="date"
                                value={promisedDate}
                                onChange={(event) => setPromisedDate(event.target.value)}
                              />
                            </FormField>
                            <Button onClick={() => void onPromise(invoice.invoiceId)}>
                              Record the promise
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {isOwner ? (
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setChosen(
                        chosen.length === sendable.length
                          ? []
                          : sendable.map((invoice) => invoice.invoiceId)
                      )
                    }
                  >
                    {chosen.length === sendable.length ? 'Choose none' : 'Choose all'}
                  </Button>

                  <FormField id="chase-template" label="Which message">
                    <Select
                      id="chase-template"
                      value={templateKey}
                      options={[
                        { value: 'invoice_reminder', label: 'A polite reminder' },
                        { value: 'invoice_overdue', label: 'A firmer note, for late invoices' },
                      ]}
                      onChange={(event) => {
                        setTemplateKey(
                          event.target.value === 'invoice_overdue'
                            ? 'invoice_overdue'
                            : 'invoice_reminder'
                        );
                      }}
                    />
                  </FormField>
                </div>

                <Button
                  isLoading={isSending}
                  loadingLabel="Sending"
                  disabled={chosen.length === 0}
                  onClick={() => void onSend()}
                >
                  {chosen.length === 0
                    ? 'Choose some invoices'
                    : `Chase ${formatNumber(chosen.length)} invoices, ${formatMoney(chosenTotal.toFixed(2), sendable[0]?.currency ?? 'USD')}`}
                </Button>
              </div>
            ) : (
              <Alert tone="info" title="Only the owner writes to clients">
                You can prepare the list, but the message itself goes out under the name of the
                business, so the owner sends it.
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
