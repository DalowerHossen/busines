// src/components/portal/portal-document.tsx
// The document a client opens from their link: an American style invoice or
// estimate, printed on screen exactly as it appears on paper.

import { Badge } from '@/components/ui/badge';
import type { PortalDocument as PortalDocumentModel } from '@/features/portal/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface PortalDocumentProps {
  /** The document the link unlocked. */
  document: PortalDocumentModel;
}

/**
 * Renders the printed document.
 *
 * @param props The document to print.
 * @returns The rendered document.
 */
export function PortalDocument({ document }: PortalDocumentProps) {
  const { brand, billTo, lines, currency } = document;
  const isInvoice = document.kind === 'invoice';
  const title = isInvoice ? 'Invoice' : 'Estimate';

  return (
    <article
      className="mx-auto w-full max-w-content rounded-lg border border-border bg-surface p-6 shadow-xs sm:p-10"
      style={{ borderTopColor: brand.primaryColor, borderTopWidth: '4px' }}
    >
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {brand.logoUrl ? (
            // The logo is hosted by the business itself, so it is rendered as a
            // plain image rather than through the optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={`${brand.legalName} logo`}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : null}
          <p className="text-lg font-semibold text-foreground">
            {brand.tradeName ?? brand.legalName}
          </p>
          {brand.addressLines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          {brand.email ? <p className="text-sm text-muted-foreground">{brand.email}</p> : null}
          {brand.phone ? <p className="text-sm text-muted-foreground">{brand.phone}</p> : null}
          {brand.taxId ? (
            <p className="text-sm text-muted-foreground">
              {brand.taxRegistrationLabel}: {brand.taxId}
            </p>
          ) : null}
        </div>

        <div className="sm:text-right">
          <h1
            className="text-2xl font-semibold uppercase tracking-wide"
            style={{ color: brand.primaryColor }}
          >
            {title}
          </h1>
          <p className="mt-1 text-base font-medium text-foreground">{document.number}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Issued {formatDate(document.issueDate)}
          </p>
          {document.dueDate ? (
            <p className="text-sm text-muted-foreground">Due {formatDate(document.dueDate)}</p>
          ) : null}
          {document.validUntil ? (
            <p className="text-sm text-muted-foreground">
              Valid until {formatDate(document.validUntil)}
            </p>
          ) : null}
          {document.purchaseOrderReference ? (
            <p className="text-sm text-muted-foreground">
              Purchase order {document.purchaseOrderReference}
            </p>
          ) : null}
          <Badge tone="brand" className="mt-3">
            {isInvoice
              ? `Balance due ${formatMoney(document.balanceDue, currency)}`
              : `Total ${formatMoney(document.totalAmount, currency)}`}
          </Badge>
        </div>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Billed to
          </h2>
          <p className="mt-2 font-medium text-foreground">{billTo.name ?? 'Customer'}</p>
          {billTo.attentionTo ? (
            <p className="text-sm text-muted-foreground">Attention: {billTo.attentionTo}</p>
          ) : null}
          {billTo.addressLines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          {billTo.email ? <p className="text-sm text-muted-foreground">{billTo.email}</p> : null}
          {billTo.taxId ? (
            <p className="text-sm text-muted-foreground">Tax number: {billTo.taxId}</p>
          ) : null}
        </div>

        {isInvoice ? (
          <div className="sm:text-right">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount due
            </h2>
            <p className="tabular mt-2 text-3xl font-semibold text-foreground">
              {formatMoney(document.balanceDue, currency)}
            </p>
            {document.dueDate ? (
              <p className="text-sm text-muted-foreground">
                Payable by {formatDate(document.dueDate)}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="visually-hidden">What this {title.toLowerCase()} covers</caption>
          <thead>
            <tr style={{ backgroundColor: `${brand.primaryColor}14` }}>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-foreground">
                Description
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-foreground">
                Quantity
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-foreground">
                Unit price
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-foreground">
                Tax
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-border align-top">
                <td className="px-3 py-3">
                  <span className="block font-medium text-foreground">{line.description}</span>
                  {line.longDescription ? (
                    <span className="block text-sm text-muted-foreground">
                      {line.longDescription}
                    </span>
                  ) : null}
                </td>
                <td className="tabular px-3 py-3 text-right">
                  {formatNumber(Number.parseFloat(line.quantity), 2)}
                  {line.unitLabel ? ` ${line.unitLabel}` : ''}
                </td>
                <td className="tabular px-3 py-3 text-right">
                  {formatMoney(line.unitPrice, currency)}
                </td>
                <td className="tabular px-3 py-3 text-right">
                  {formatMoney(line.taxAmount, currency)}
                </td>
                <td className="tabular px-3 py-3 text-right">
                  {formatMoney(line.lineTotal, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular">{formatMoney(document.subtotalAmount, currency)}</dd>
          </div>
          {document.discountAmount !== '0.00' ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular">-{formatMoney(document.discountAmount, currency)}</dd>
            </div>
          ) : null}
          {document.shippingAmount !== '0.00' ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular">{formatMoney(document.shippingAmount, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="tabular">{formatMoney(document.taxAmount, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular">{formatMoney(document.totalAmount, currency)}</dd>
          </div>
          {isInvoice ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid so far</dt>
                <dd className="tabular">{formatMoney(document.paidAmount, currency)}</dd>
              </div>
              <div
                className="flex justify-between border-t border-border pt-2 text-base font-semibold"
                style={{ color: brand.primaryColor }}
              >
                <dt>Balance due</dt>
                <dd className="tabular">{formatMoney(document.balanceDue, currency)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      {document.notes || document.termsAndConditions ? (
        <section className="mt-8 space-y-4 border-t border-border pt-6 text-sm">
          {document.notes ? (
            <div>
              <h2 className="font-semibold text-foreground">Notes</h2>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{document.notes}</p>
            </div>
          ) : null}
          {document.termsAndConditions ? (
            <div>
              <h2 className="font-semibold text-foreground">Terms</h2>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {document.termsAndConditions}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {document.footerNote ? (
        <footer className="mt-8 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          {document.footerNote}
        </footer>
      ) : null}
    </article>
  );
}
