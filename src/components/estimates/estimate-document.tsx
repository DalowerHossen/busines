// src/components/estimates/estimate-document.tsx
// The quotation as the client sees it: who it is for, how long the price
// stands, what is included, and what the whole thing comes to.

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
import type { EstimateDetail, EstimateParty } from '@/features/estimates/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface EstimateDocumentProps {
  /** Estimate being shown. */
  estimate: EstimateDetail;
  /** Name of the business making the offer. */
  companyName: string;
}

/**
 * Writes the billing party as the lines that appear on the document.
 *
 * @param party The frozen billing party.
 * @param fallbackName Name used while the quotation is still a draft.
 * @returns The lines of the address.
 */
function toPartyLines(party: EstimateParty, fallbackName: string): string[] {
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
 * Renders the printable body of an estimate.
 *
 * @param props The estimate and the name of the business.
 * @returns The rendered document.
 */
export function EstimateDocument({ estimate, companyName }: EstimateDocumentProps) {
  const partyLines = toPartyLines(estimate.billTo, estimate.clientName);

  return (
    <Card>
      <CardContent className="space-y-8 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{companyName}</h2>
            <p className="text-sm text-muted-foreground">
              {estimate.estimateNumber === null
                ? 'Draft estimate, not yet sent'
                : `Estimate ${estimate.estimateNumber}`}
            </p>
            {estimate.title === null ? null : (
              <p className="mt-1 text-sm font-medium text-foreground">{estimate.title}</p>
            )}
          </div>
          <dl className="space-y-1 text-sm sm:text-right">
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-muted-foreground">Issue date</dt>
              <dd className="tabular text-foreground">{formatDate(estimate.issueDate)}</dd>
            </div>
            <div className="flex gap-3 sm:justify-end">
              <dt className="text-muted-foreground">Valid until</dt>
              <dd className="tabular text-foreground">
                {estimate.validUntil === null ? 'No end date' : formatDate(estimate.validUntil)}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Prepared for</h3>
          <address className="text-sm not-italic text-foreground">
            {partyLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>

        <Table caption={`Lines of estimate ${estimate.estimateNumber ?? 'draft'}`}>
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
            {estimate.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <span className="font-medium text-foreground">{line.description}</span>
                  {line.isOptional ? (
                    <p className="text-xs text-muted-foreground">
                      {line.isSelected ? 'Optional, included' : 'Optional, not included'}
                    </p>
                  ) : null}
                  {line.longDescription === null ? null : (
                    <p className="text-xs text-muted-foreground">{line.longDescription}</p>
                  )}
                </TableCell>
                <TableCell isNumeric>
                  {formatNumber(Number.parseFloat(line.quantity))}
                  {line.unitLabel === null ? '' : ` ${line.unitLabel}`}
                </TableCell>
                <TableCell isNumeric>{formatMoney(line.unitPrice, estimate.currency)}</TableCell>
                <TableCell isNumeric>
                  {Number.parseFloat(line.taxPercentage) === 0 ? 'None' : `${line.taxPercentage}%`}
                </TableCell>
                <TableCell isNumeric>{formatMoney(line.lineTotal, estimate.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Subtotal</TableCell>
              <TableCell isNumeric>
                {formatMoney(estimate.subtotalAmount, estimate.currency)}
              </TableCell>
            </TableRow>
            {Number.parseFloat(estimate.discountAmount) === 0 ? null : (
              <TableRow>
                <TableCell colSpan={4}>Discount</TableCell>
                <TableCell isNumeric>
                  {formatMoney(estimate.discountAmount, estimate.currency)}
                </TableCell>
              </TableRow>
            )}
            {Number.parseFloat(estimate.shippingAmount) === 0 ? null : (
              <TableRow>
                <TableCell colSpan={4}>Delivery</TableCell>
                <TableCell isNumeric>
                  {formatMoney(estimate.shippingAmount, estimate.currency)}
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell colSpan={4}>Tax</TableCell>
              <TableCell isNumeric>{formatMoney(estimate.taxAmount, estimate.currency)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4}>TOTAL</TableCell>
              <TableCell isNumeric>
                {formatMoney(estimate.totalAmount, estimate.currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {estimate.notes === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Notes</h3>
            <p className="whitespace-pre-line text-sm text-foreground">{estimate.notes}</p>
          </div>
        )}

        {estimate.termsAndConditions === null ? null : (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Terms</h3>
            <p className="whitespace-pre-line text-sm text-foreground">
              {estimate.termsAndConditions}
            </p>
          </div>
        )}

        {estimate.footerNote === null ? null : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {estimate.footerNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
