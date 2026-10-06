// src/components/receipts/receipt-detail.tsx
// One receipt laid out in full, so a figure that looks wrong can be traced
// back to the words the reader saw.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReceiptDetailRecord } from '@/features/receipts/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface ReceiptDetailProps {
  /** The receipt being shown. */
  receipt: ReceiptDetailRecord;
}

/**
 * Renders one receipt in full.
 *
 * @param props The receipt.
 * @returns The rendered receipt.
 */
export function ReceiptDetail({ receipt }: ReceiptDetailProps) {
  const facts = [
    { key: 'merchant', label: 'Merchant', value: receipt.merchantName ?? 'Not found' },
    { key: 'tax-id', label: 'Merchant tax number', value: receipt.merchantTaxId ?? 'Not found' },
    {
      key: 'date',
      label: 'Date on the receipt',
      value: receipt.receiptDate === null ? 'Not found' : formatDate(receipt.receiptDate),
    },
    { key: 'number', label: 'Receipt number', value: receipt.receiptNumber ?? 'Not found' },
    { key: 'currency', label: 'Currency', value: receipt.currency ?? 'Not found' },
    { key: 'net', label: 'Net', value: receipt.subtotalAmount ?? 'Not found' },
    { key: 'tax', label: 'Tax', value: receipt.taxAmount ?? 'Not found' },
    { key: 'tip', label: 'Tip', value: receipt.tipAmount ?? 'Not found' },
    { key: 'total', label: 'Total', value: receipt.totalAmount ?? 'Not found' },
    {
      key: 'method',
      label: 'How it was paid',
      value:
        receipt.paymentMethodHint === null
          ? 'Not found'
          : `${humanise(receipt.paymentMethodHint)}${receipt.cardLast4 === null ? '' : ` ending ${receipt.cardLast4}`}`,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What was read</CardTitle>
          <CardDescription>
            Sent in {formatDateTime(receipt.uploadedAt)} from {humanise(receipt.source)}
            {receipt.provider === null ? '' : `, read by ${receipt.provider}`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{humanise(receipt.status)}</Badge>
            <Badge tone="neutral">{`${Math.round(Number(receipt.overallConfidence ?? '0'))}% sure`}</Badge>
            {receipt.lowConfidenceFields.map((field) => (
              <Badge key={field} tone="warning">
                {`${humanise(field)} needs checking`}
              </Badge>
            ))}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.key} className="space-y-1">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="tabular text-sm font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items on the receipt</CardTitle>
          <CardDescription>
            {receipt.lines.length === 0
              ? 'The reader did not find separate items on this receipt.'
              : 'Each line as it was printed on the paper.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receipt.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Only the totals were found. Correct them on the receipts screen if they look wrong.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead isNumeric>Quantity</TableHead>
                  <TableHead isNumeric>Unit price</TableHead>
                  <TableHead isNumeric>Tax</TableHead>
                  <TableHead isNumeric>Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lines.map((line) => (
                  <TableRow key={`${line.lineOrder}-${line.description}`}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell isNumeric>{line.quantity}</TableCell>
                    <TableCell isNumeric>{line.unitPrice ?? '—'}</TableCell>
                    <TableCell isNumeric>{line.taxAmount}</TableCell>
                    <TableCell isNumeric>{line.lineTotal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {receipt.rawText === null ? null : (
        <Card>
          <CardHeader>
            <CardTitle>The text the reader saw</CardTitle>
            <CardDescription>
              Kept so a figure that looks wrong can be checked against the paper.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-surface-muted p-4 text-xs text-muted-foreground">
              {receipt.rawText}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
