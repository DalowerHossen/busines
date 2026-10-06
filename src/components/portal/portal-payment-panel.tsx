// src/components/portal/portal-payment-panel.tsx
// How a client settles the invoice they are looking at: the amount still
// owed, and the bank details the business asked to be paid into.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortalDocument } from '@/features/portal/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface PortalPaymentPanelProps {
  /** The invoice the client opened. */
  document: PortalDocument;
}

/**
 * Renders the payment instructions beside an invoice.
 *
 * @param props The invoice being paid.
 * @returns The rendered panel, or null when nothing is owed.
 */
export function PortalPaymentPanel({ document }: PortalPaymentPanelProps) {
  const { brand, currency } = document;
  const isSettled = Number.parseFloat(document.balanceDue) <= 0;

  const bankRows = [
    { label: 'Bank', value: brand.bankName },
    { label: 'Account name', value: brand.bankAccountName },
    { label: 'Account number', value: brand.bankAccountNumber },
    { label: 'Routing or sort code', value: brand.bankRoutingNumber },
    { label: 'SWIFT or BIC', value: brand.bankSwiftCode },
    { label: 'IBAN', value: brand.bankIban },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  return (
    <Card className="mx-auto w-full max-w-content">
      <CardHeader>
        <CardTitle>{isSettled ? 'This invoice is settled' : 'How to pay'}</CardTitle>
        <CardDescription>
          {isSettled
            ? 'Nothing further is owed. Thank you.'
            : `${formatMoney(document.balanceDue, currency)} is outstanding${
                document.dueDate ? ` and due by ${formatDate(document.dueDate)}` : ''
              }.`}
        </CardDescription>
      </CardHeader>

      {isSettled ? null : (
        <CardContent className="space-y-4">
          {bankRows.length > 0 ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {bankRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Reply to the email this invoice came with and the sender will confirm how they would
              like to be paid.
            </p>
          )}

          {brand.remitToInstructions ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {brand.remitToInstructions}
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Please quote {document.number} with your payment so it is matched to this invoice
            straight away.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
