// src/components/shared/invoice-print-document.tsx
// Browser/server HTML print preview that uses the phase-22 print stylesheet.
// It is intentionally separate from the server-only React-PDF document.
import type { ReactElement } from 'react';

import {
  cleanPdfText,
  documentLabel,
  formatPdfDate,
  formatPdfMoney,
  formatPdfQuantity,
} from '@/lib/pdf/format';
import type { InvoicePdfInput, PdfAddress, PdfLineItem, PdfParty } from '@/lib/pdf/types';

function addressText(address: PdfAddress | null | undefined): string {
  if (!address) return '';
  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', '),
    address.postalCode,
    address.country,
  ]
    .map((line) => cleanPdfText(line))
    .filter(Boolean)
    .join('\n');
}

function partyDetails(party: PdfParty): string {
  return [party.email, party.phone, party.taxId ? `Tax ID: ${party.taxId}` : null]
    .map((line) => cleanPdfText(line))
    .filter(Boolean)
    .join('\n');
}

function lineDetails(item: PdfLineItem): string {
  return [
    item.itemCode ? `Code: ${cleanPdfText(item.itemCode)}` : null,
    item.unitOfMeasure ? `Unit: ${cleanPdfText(item.unitOfMeasure)}` : null,
    item.taxRatePercent ? `Tax: ${cleanPdfText(item.taxRatePercent)}%` : null,
    item.discountPercent ? `Discount: ${cleanPdfText(item.discountPercent)}%` : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function renderParty(party: PdfParty): ReactElement {
  return (
    <>
      <p className="invoice-print-party-name">{cleanPdfText(party.name)}</p>
      {addressText(party.address) ? (
        <p className="invoice-print-muted invoice-print-address">{addressText(party.address)}</p>
      ) : null}
      {partyDetails(party) ? (
        <p className="invoice-print-muted invoice-print-party-details">{partyDetails(party)}</p>
      ) : null}
    </>
  );
}

export function InvoicePrintDocument({ input }: { readonly input: InvoicePdfInput }): ReactElement {
  const pageSize = input.pageSize ?? 'A4';
  const locale = input.locale ?? 'en-US';
  const label = documentLabel(input.documentType);
  const title = cleanPdfText(input.title) || label;
  const logo = typeof input.company.logo === 'string' ? input.company.logo : null;

  return (
    <article
      className="invoice-print-document"
      data-page-size={pageSize}
      aria-label={`${title} ${cleanPdfText(input.documentNumber)}`}
    >
      <header className="invoice-print-header">
        <div className="invoice-print-brand">
          {logo ? (
            // The print preview intentionally uses the supplied source without
            // Next image optimization so its printed dimensions stay stable.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="invoice-print-logo" src={logo} alt="" aria-hidden="true" />
          ) : null}
          <div>
            <p className="invoice-print-company-name">{cleanPdfText(input.company.name)}</p>
            {addressText(input.company.address) ? (
              <p className="invoice-print-muted invoice-print-address">
                {addressText(input.company.address)}
              </p>
            ) : null}
            {partyDetails(input.company) ? (
              <p className="invoice-print-muted invoice-print-party-details">
                {partyDetails(input.company)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="invoice-print-header-meta">
          <p className="invoice-print-title">{title}</p>
          <div className="invoice-print-document-number">{cleanPdfText(input.documentNumber)}</div>
          {input.status ? (
            <div className="invoice-print-status">{cleanPdfText(input.status)}</div>
          ) : null}
        </div>
      </header>

      <section className="invoice-print-parties" aria-label="Document parties">
        <div className="invoice-print-party">
          <p className="invoice-print-party-label">Bill to</p>
          {renderParty(input.client)}
        </div>
        <div className="invoice-print-party">
          <p className="invoice-print-party-label">Issued by</p>
          {renderParty(input.company)}
        </div>
      </section>

      <section className="invoice-print-metadata" aria-label="Document details">
        <div>
          <p className="invoice-print-metadata-label">Issue date</p>
          <p className="invoice-print-metadata-value">{formatPdfDate(input.issueDate, locale)}</p>
        </div>
        {input.dueDate ? (
          <div>
            <p className="invoice-print-metadata-label">Due date</p>
            <p className="invoice-print-metadata-value">{formatPdfDate(input.dueDate, locale)}</p>
          </div>
        ) : null}
        <div>
          <p className="invoice-print-metadata-label">Currency</p>
          <p className="invoice-print-metadata-value">{input.currency}</p>
        </div>
      </section>

      <table className="invoice-print-table">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Qty</th>
            <th scope="col">Unit price</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {input.lineItems.length > 0 ? (
            input.lineItems.map((item, index) => (
              <tr key={`${cleanPdfText(item.description)}-${index}`}>
                <td>
                  <span className="invoice-print-item-description">
                    {cleanPdfText(item.description)}
                  </span>
                  {lineDetails(item) ? (
                    <span className="invoice-print-item-details">{lineDetails(item)}</span>
                  ) : null}
                </td>
                <td>{formatPdfQuantity(item.quantity)}</td>
                <td>{formatPdfMoney(item.unitPrice, input.currency)}</td>
                <td>{formatPdfMoney(item.lineTotal, input.currency)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No line items recorded.</td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="invoice-print-totals" aria-label="Totals">
        <table>
          <tbody>
            <tr>
              <td className="invoice-print-muted">Subtotal</td>
              <td>{formatPdfMoney(input.subtotal, input.currency)}</td>
            </tr>
            <tr>
              <td className="invoice-print-muted">Discount</td>
              <td>{formatPdfMoney(input.discountTotal, input.currency)}</td>
            </tr>
            <tr>
              <td className="invoice-print-muted">Tax</td>
              <td>{formatPdfMoney(input.taxTotal, input.currency)}</td>
            </tr>
            <tr className="invoice-print-grand-total">
              <td>Total</td>
              <td>{formatPdfMoney(input.total, input.currency)}</td>
            </tr>
            {input.amountPaid ? (
              <tr>
                <td className="invoice-print-muted">Paid</td>
                <td>{formatPdfMoney(input.amountPaid, input.currency)}</td>
              </tr>
            ) : null}
            {input.amountDue ? (
              <tr>
                <td className="invoice-print-muted">Amount due</td>
                <td>{formatPdfMoney(input.amountDue, input.currency)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {input.taxBreakdown && input.taxBreakdown.length > 0 ? (
        <table className="invoice-print-tax-table">
          <caption className="invoice-print-information-title">Tax breakdown</caption>
          <thead>
            <tr>
              <th scope="col">Tax</th>
              <th scope="col">Rate</th>
              <th scope="col">Taxable amount</th>
              <th scope="col">Tax amount</th>
            </tr>
          </thead>
          <tbody>
            {input.taxBreakdown.map((row, index) => (
              <tr key={`${cleanPdfText(row.label)}-${index}`}>
                <td>{cleanPdfText(row.label)}</td>
                <td>{cleanPdfText(row.ratePercent)}%</td>
                <td>{formatPdfMoney(row.taxableAmount, input.currency)}</td>
                <td>{formatPdfMoney(row.taxAmount, input.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <section className="invoice-print-information-grid">
        {input.remitTo ? (
          <div className="invoice-print-information-block">
            <p className="invoice-print-information-title">
              {cleanPdfText(input.remitTo.label) || 'Remit to'}
            </p>
            <p className="invoice-print-information-text">
              {input.remitTo.lines
                .map((line) => cleanPdfText(line))
                .filter(Boolean)
                .join('\n')}
            </p>
          </div>
        ) : null}
        {input.notes ? (
          <div className="invoice-print-information-block">
            <p className="invoice-print-information-title">Notes</p>
            <p className="invoice-print-information-text">{cleanPdfText(input.notes)}</p>
          </div>
        ) : null}
        {input.termsAndConditions ? (
          <div className="invoice-print-information-block">
            <p className="invoice-print-information-title">Terms and conditions</p>
            <p className="invoice-print-information-text">
              {cleanPdfText(input.termsAndConditions)}
            </p>
          </div>
        ) : null}
      </section>

      {input.footerText ? (
        <p className="invoice-print-information-text">{cleanPdfText(input.footerText)}</p>
      ) : null}

      <footer className="invoice-print-footer">
        <span>{cleanPdfText(input.company.name)}</span>
        <span className="invoice-print-footer-page" aria-label="Page number" />
      </footer>
    </article>
  );
}
