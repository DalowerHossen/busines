// src/components/invoices/invoice-activity.tsx
// What has happened to this invoice so far: written, issued, sent, opened by
// the client, paid. Read from the timestamps the document itself carries.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InvoiceDetail } from '@/features/invoices/types';
import { describeRelative, formatDateTime } from '@/lib/dates';

export interface InvoiceActivityProps {
  /** Invoice being described. */
  invoice: InvoiceDetail;
}

interface ActivityEntry {
  key: string;
  label: string;
  at: string;
  detail: string | null;
}

/**
 * Renders the history of one invoice.
 *
 * @param props The invoice to describe.
 * @returns The rendered history.
 */
export function InvoiceActivity({ invoice }: InvoiceActivityProps) {
  const entries: ActivityEntry[] = [];

  if (invoice.createdAt !== null) {
    entries.push({ key: 'created', label: 'Draft written', at: invoice.createdAt, detail: null });
  }

  if (invoice.issuedAt !== null) {
    entries.push({
      key: 'issued',
      label: 'Issued',
      at: invoice.issuedAt,
      detail: invoice.invoiceNumber === null ? null : `Number ${invoice.invoiceNumber}`,
    });
  }

  if (invoice.sentAt !== null) {
    entries.push({ key: 'sent', label: 'Sent to the client', at: invoice.sentAt, detail: null });
  }

  if (invoice.firstViewedAt !== null) {
    entries.push({
      key: 'viewed',
      label: 'Opened by the client',
      at: invoice.firstViewedAt,
      detail: invoice.viewCount > 1 ? `Opened ${invoice.viewCount} times` : null,
    });
  }

  if (invoice.paidAt !== null) {
    entries.push({ key: 'paid', label: 'Paid in full', at: invoice.paidAt, detail: null });
  }

  if (invoice.cancelledAt !== null) {
    entries.push({
      key: 'cancelled',
      label: 'Cancelled',
      at: invoice.cancelledAt,
      detail: invoice.cancellationReason,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Every step this document has taken, in order.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has happened to this invoice yet beyond writing it.
          </p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.key} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)} · {describeRelative(entry.at)}
                  </p>
                  {entry.detail === null ? null : (
                    <p className="text-sm text-muted-foreground">{entry.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
