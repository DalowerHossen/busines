// src/components/invoices/invoice-document.tsx
// The invoice as the client sees it: the party it is addressed to, the lines,
// the tax and the amount due, set out in the American style that buyers and
// marketplaces expect.

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { findCountry } from '@/config/countries';
import type { InvoiceDetail, InvoiceParty } from '@/features/invoices/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface InvoiceDocumentProps {
  /** Invoice being shown. */
  invoice: InvoiceDetail;
  /** Name of the business raising the invoice. */
  companyName: string;
}

/**
 * Writes the billing party as the lines that appear on the document.
 *
 * @param party The frozen billing party.
 * @param fallbackName Name used when the document was never issued.
 * @returns The lines of the address.
 */
function toPartyLines(party: InvoiceParty, fallbackName: string): string[] {
  const country = party.countryCode === null ? null : findCountry(party.countryCode);

  return [
    party.name ?? fallbackName,
    party.attentionTo,
    party.addressLine1,
    party.addressLine2,
    [party.city, party.stateRegion, party.postalCode].filter(Boolean).join(', '),
    country?.name ?? party.countryCode,
    party.taxId === null ? null : `Tax identification ${party.taxId}`,
  ].filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
}

/**
 * Renders the printable body of an invoice.
 *
 * @param props The invoice and the name of the business.
 * @returns The rendered document.
 */
export function InvoiceDocument({ invoice, companyName }: InvoiceDocumentProps) {
  const partyLines = toPartyLines(invoice.billTo, invoice.clientName);

  return (
    <Card>
      <CardContent className="space-y-8 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{companyName}</h2>
            <p className="text-sm text-muted-foreground">
              {invoice.invoiceNumber === null
                ? 'Draft invoice, not yet issued'
                : `Invoice ${invoice.invoiceNumber}`}
            </p>
          </div>
          <dl className="space-y-1 text-sm sm:text-right">
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-muted-foreground">Issue date</dt>
              <dd className="tabular text-foreground">{formatDate(invoice.issueDate)}</dd>
            </div>
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="tabular text-foreground">{formatDate(invoice.dueDate)}</dd>
            </div>
            {invoice.purchaseOrderReference === null ? null : (
              <div className="flex gap-3 sm:justify-end">
                <dt className="text-muted-foreground">Your order</dt>
                <dd className="text-foreground">{invoice.purchaseOrderReference}</dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</h3>
          <address className="text-sm not-italic text-foreground">
            {partyLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>

        <Table caption={`Lines of invoice ${invoice.invoiceNumber ?? 'draft'}`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Description</TableHead>
              <TableHead scope="col" isNumeric>
                Quantity
              </TableHead>
              <TableHead scope="col" isNumeric>
                Unit price
              </TableHead>
              <TableHead scope="col" isNumeric>
                Tax
              </TableHead>
              <TableHead scope="col" isNumeric>
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <span className="font-medium text-foreground">{line.description}</span>
                  {line.longDescription === null ? null : (
                    <p className="text-xs text-muted-foreground">{line.longDescription}</p>
                  )}
                </TableCell>
                <TableCell isNumeric>
                  {formatNumber(Number.parseFloat(line.quantity))}
                  {line.unitLabel === null ? '' : ` ${line.unitLabel}`}
                </TableCell>
                <TableCell isNumeric>{formatMoney(line.unitPrice, invoice.currency)}</TableCell>
                <TableCell isNumeric>
                  {Number.parseFloat(line.taxPercentage) === 0 ? 'None' : `${line.taxPercentage}%`}
                </TableCell>
                <TableCell isNumeric>{formatMoney(line.lineTotal, invoice.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Subtotal</TableCell>
              <TableCell isNumeric>
                {formatMoney(invoice.subtotalAmount, invoice.currency)}
              </TableCell>
            </TableRow>
            {Number.parseFloat(invoice.lineDiscountAmount) === 0 ? null : (
              <TableRow>
                <TableCell colSpan={4}>Discount</TableCell>
                <TableCell isNumeric>
                  {formatMoney(invoice.lineDiscountAmount, invoice.currency)}
                </TableCell>
              </TableRow>
            )}
            {Number.parseFloat(invoice.shippingAmount) === 0 ? null : (
              <TableRow>
                <TableCell colSpan={4}>Delivery</TableCell>
                <TableCell isNumeric>
                  {formatMoney(invoice.shippingAmount, invoice.currency)}
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell colSpan={4}>Tax</TableCell>
              <TableCell isNumeric>{formatMoney(invoice.taxAmount, invoice.currency)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4}>TOTAL</TableCell>
              <TableCell isNumeric>{formatMoney(invoice.totalAmount, invoice.currency)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4}>Amount due</TableCell>
              <TableCell isNumeric>{formatMoney(invoice.balanceDue, invoice.currency)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {invoice.notes === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Notes</h3>
            <p className="whitespace-pre-line text-sm text-foreground">{invoice.notes}</p>
          </div>
        )}

        {invoice.termsAndConditions === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Payment terms</h3>
            <p className="whitespace-pre-line text-sm text-foreground">
              {invoice.termsAndConditions}
            </p>
          </div>
        )}

        {invoice.footerNote === null ? null : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {invoice.footerNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
