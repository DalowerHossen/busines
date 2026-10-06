// src/components/clients/client-billing-card.tsx
// What this client owes, what they have paid, and the terms every new invoice
// for them starts from.

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientBillingSummary } from '@/features/clients/queries/get-client';
import type { ClientDetail } from '@/features/clients/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ClientBillingCardProps {
  /** Client being shown. */
  client: ClientDetail;
  /** Totals of the invoices raised against the client. */
  summary: ClientBillingSummary;
}

/**
 * Renders the billing card of a client.
 *
 * @param props The client and its invoice totals.
 * @returns The rendered card.
 */
export function ClientBillingCard({ client, summary }: ClientBillingCardProps) {
  const currency = client.billingCurrency ?? summary.currency;

  const figures = [
    { label: 'Outstanding', value: formatMoney(summary.outstandingTotal, summary.currency) },
    { label: 'Paid to date', value: formatMoney(summary.paidTotal, summary.currency) },
    { label: 'Invoices raised', value: formatNumber(summary.invoiceCount) },
  ];

  const terms = [
    { label: 'Billing currency', value: currency },
    {
      label: 'Payment terms',
      value:
        client.defaultPaymentTermsDays === null
          ? 'Due on receipt'
          : `${formatNumber(client.defaultPaymentTermsDays)} days`,
    },
    {
      label: 'Credit limit',
      value: client.creditLimit === null ? 'No limit' : formatMoney(client.creditLimit, currency),
    },
    {
      label: 'Late fee',
      value: client.lateFeePercentage === null ? 'None' : `${client.lateFeePercentage}%`,
    },
    { label: 'Tax identification', value: client.taxId ?? 'Not recorded' },
    { label: 'VAT number', value: client.vatNumber ?? 'Not recorded' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary.isDegraded ? (
          <Alert tone="warning" title="Figures are not available">
            The billing totals could not be read just now. The client details below are still
            correct.
          </Alert>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.label} className="rounded-lg bg-surface-muted p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {figure.label}
              </dt>
              <dd className="tabular text-lg font-semibold text-foreground">{figure.value}</dd>
            </div>
          ))}
        </dl>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {term.label}
              </dt>
              <dd className="text-sm text-foreground">{term.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Badge tone={client.sendReminders ? 'success' : 'neutral'}>
            {client.sendReminders ? 'Reminders on' : 'Reminders off'}
          </Badge>
          <Badge tone={client.statementDeliveryEnabled ? 'success' : 'neutral'}>
            {client.statementDeliveryEnabled ? 'Monthly statement on' : 'Monthly statement off'}
          </Badge>
          {client.isTaxExempt ? <Badge tone="info">Tax exempt</Badge> : null}
          {client.appliesReverseCharge ? <Badge tone="info">Reverse charge</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
