// src/lib/pdf/document.tsx
// A4/Letter invoice document tree. Fixed header, table header, and footer
// nodes use React-PDF's pagination primitives so multi-page tables remain
// printable and legally legible.
import 'server-only';

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from './fonts';
import {
  cleanPdfText,
  documentLabel,
  formatPdfDate,
  formatPdfMoney,
  formatPdfQuantity,
} from './format';
import type {
  InvoicePdfInput,
  PdfAddress,
  PdfLineItem,
  PdfPageSize,
  PdfParty,
  PdfTaxBreakdownItem,
} from './types';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#172033',
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.35,
    paddingBottom: 52,
    paddingHorizontal: 42,
    paddingTop: 42,
  },
  header: {
    alignItems: 'flex-start',
    borderBottomColor: '#d9e0eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
  },
  brandBlock: {
    flexDirection: 'row',
    maxWidth: '58%',
  },
  logo: {
    height: 42,
    marginRight: 10,
    objectFit: 'contain',
    width: 42,
  },
  companyName: {
    color: '#12264a',
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: '#5d6b82',
  },
  headerMeta: {
    alignItems: 'flex-end',
    maxWidth: '38%',
  },
  documentTitle: {
    color: '#1d4ed8',
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  documentNumber: {
    color: '#172033',
    fontSize: 11,
    fontWeight: 700,
  },
  status: {
    backgroundColor: '#e8f0ff',
    borderRadius: 3,
    color: '#1d4ed8',
    fontSize: 8,
    fontWeight: 700,
    marginTop: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginTop: 20,
  },
  partyBlock: {
    maxWidth: '47%',
  },
  partyLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  partyName: {
    color: '#172033',
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 2,
  },
  metadata: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  metadataItem: {
    marginRight: 30,
  },
  metadataLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  metadataValue: {
    color: '#172033',
    fontSize: 9,
  },
  table: {
    borderColor: '#d9e0eb',
    borderRadius: 3,
    borderWidth: 1,
    marginBottom: 18,
  },
  tableHeader: {
    backgroundColor: '#eef3fb',
    color: '#334155',
    flexDirection: 'row',
    fontSize: 8,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  tableRow: {
    borderTopColor: '#e5eaf2',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  descriptionColumn: {
    paddingRight: 8,
    width: '44%',
  },
  quantityColumn: {
    textAlign: 'right',
    width: '13%',
  },
  unitPriceColumn: {
    paddingLeft: 8,
    textAlign: 'right',
    width: '20%',
  },
  totalColumn: {
    paddingLeft: 8,
    textAlign: 'right',
    width: '23%',
  },
  itemDescription: {
    color: '#172033',
    fontWeight: 700,
  },
  itemDetails: {
    color: '#64748b',
    fontSize: 8,
    marginTop: 2,
  },
  totalsLayout: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 22,
  },
  totals: {
    width: '48%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    color: '#5d6b82',
  },
  totalValue: {
    color: '#172033',
    textAlign: 'right',
  },
  grandTotalRow: {
    borderTopColor: '#172033',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
  },
  grandTotalLabel: {
    color: '#12264a',
    fontSize: 11,
    fontWeight: 700,
  },
  grandTotalValue: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
  },
  informationGrid: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 18,
  },
  informationBlock: {
    flex: 1,
  },
  informationTitle: {
    color: '#12264a',
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
  informationText: {
    color: '#5d6b82',
    fontSize: 8.5,
    lineHeight: 1.4,
  },
  taxTable: {
    borderColor: '#d9e0eb',
    borderWidth: 1,
    marginBottom: 18,
    padding: 8,
  },
  taxRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  taxLabel: {
    width: '25%',
  },
  taxRate: {
    color: '#5d6b82',
    width: '20%',
  },
  taxAmount: {
    textAlign: 'right',
    width: '27.5%',
  },
  footer: {
    bottom: 20,
    color: '#64748b',
    flexDirection: 'row',
    fontSize: 7.5,
    justifyContent: 'space-between',
    left: 42,
    position: 'absolute',
    right: 42,
  },
  emptyRow: {
    color: '#64748b',
    padding: 10,
  },
});

function renderAddress(address: PdfAddress | null | undefined): ReactElement | null {
  if (!address) return null;
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', '),
    address.postalCode,
    address.country,
  ]
    .map((line) => cleanPdfText(line))
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <Text style={styles.muted}>
      {lines.map((line, index) => (
        <Text key={`${line}-${index}`}>
          {index > 0 ? '\n' : ''}
          {line}
        </Text>
      ))}
    </Text>
  );
}

function renderParty(party: PdfParty): ReactElement {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyName}>{cleanPdfText(party.name)}</Text>
      {renderAddress(party.address)}
      {party.email ? <Text style={styles.muted}>{cleanPdfText(party.email)}</Text> : null}
      {party.phone ? <Text style={styles.muted}>{cleanPdfText(party.phone)}</Text> : null}
      {party.taxId ? <Text style={styles.muted}>Tax ID: {cleanPdfText(party.taxId)}</Text> : null}
    </View>
  );
}

function renderLineItem(
  item: PdfLineItem,
  expectedCurrency: InvoicePdfInput['currency'],
  index: number
): ReactElement {
  const details = [
    item.itemCode ? `Code: ${cleanPdfText(item.itemCode)}` : null,
    item.unitOfMeasure ? `Unit: ${cleanPdfText(item.unitOfMeasure)}` : null,
    item.taxRatePercent ? `Tax: ${cleanPdfText(item.taxRatePercent)}%` : null,
    item.discountPercent ? `Discount: ${cleanPdfText(item.discountPercent)}%` : null,
  ].filter(Boolean);

  return (
    <View key={`${cleanPdfText(item.description)}-${index}`} style={styles.tableRow} wrap={false}>
      <View style={styles.descriptionColumn}>
        <Text style={styles.itemDescription}>{cleanPdfText(item.description)}</Text>
        {details.length > 0 ? <Text style={styles.itemDetails}>{details.join(' • ')}</Text> : null}
      </View>
      <Text style={styles.quantityColumn}>{formatPdfQuantity(item.quantity)}</Text>
      <Text style={styles.unitPriceColumn}>{formatPdfMoney(item.unitPrice, expectedCurrency)}</Text>
      <Text style={styles.totalColumn}>{formatPdfMoney(item.lineTotal, expectedCurrency)}</Text>
    </View>
  );
}

function renderTaxBreakdown(
  rows: readonly PdfTaxBreakdownItem[],
  expectedCurrency: InvoicePdfInput['currency']
): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <View style={styles.taxTable} wrap={false}>
      <Text style={styles.informationTitle}>Tax breakdown</Text>
      {rows.map((row, index) => (
        <View key={`${cleanPdfText(row.label)}-${index}`} style={styles.taxRow}>
          <Text style={styles.taxLabel}>{cleanPdfText(row.label)}</Text>
          <Text style={styles.taxRate}>{cleanPdfText(row.ratePercent)}%</Text>
          <Text style={styles.taxAmount}>
            {formatPdfMoney(row.taxableAmount, expectedCurrency)}
          </Text>
          <Text style={styles.taxAmount}>{formatPdfMoney(row.taxAmount, expectedCurrency)}</Text>
        </View>
      ))}
    </View>
  );
}

export function InvoicePdfDocument({ input }: { readonly input: InvoicePdfInput }): ReactElement {
  ensurePdfFontsRegistered();
  const pageSize: PdfPageSize = input.pageSize ?? 'A4';
  const locale = input.locale ?? 'en-US';
  const label = documentLabel(input.documentType);
  const title = cleanPdfText(input.title) || label;
  const status = cleanPdfText(input.status);

  return (
    <Document
      author="KD SOLUTION IT"
      creator="KD SOLUTION IT"
      language="en-US"
      subject={`${label} ${cleanPdfText(input.documentNumber)}`}
      title={`${title} ${cleanPdfText(input.documentNumber)}`}
    >
      <Page size={pageSize} style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brandBlock}>
            {input.company.logo ? (
              // PDF image metadata does not expose an HTML alt attribute.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image source={input.company.logo} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.companyName}>{cleanPdfText(input.company.name)}</Text>
              {renderAddress(input.company.address)}
              {input.company.email ? (
                <Text style={styles.muted}>{cleanPdfText(input.company.email)}</Text>
              ) : null}
              {input.company.phone ? (
                <Text style={styles.muted}>{cleanPdfText(input.company.phone)}</Text>
              ) : null}
              {input.company.taxId ? (
                <Text style={styles.muted}>Tax ID: {cleanPdfText(input.company.taxId)}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.documentTitle}>{title}</Text>
            <Text style={styles.documentNumber}>{cleanPdfText(input.documentNumber)}</Text>
            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill to</Text>
            {renderParty(input.client)}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Issued by</Text>
            {renderParty(input.company)}
          </View>
        </View>

        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Issue date</Text>
            <Text style={styles.metadataValue}>{formatPdfDate(input.issueDate, locale)}</Text>
          </View>
          {input.dueDate ? (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Due date</Text>
              <Text style={styles.metadataValue}>{formatPdfDate(input.dueDate, locale)}</Text>
            </View>
          ) : null}
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Currency</Text>
            <Text style={styles.metadataValue}>{input.currency}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.descriptionColumn}>Description</Text>
            <Text style={styles.quantityColumn}>Qty</Text>
            <Text style={styles.unitPriceColumn}>Unit price</Text>
            <Text style={styles.totalColumn}>Amount</Text>
          </View>
          {input.lineItems.length > 0 ? (
            input.lineItems.map((item, index) => renderLineItem(item, input.currency, index))
          ) : (
            <Text style={styles.emptyRow}>No line items recorded.</Text>
          )}
        </View>

        <View style={styles.totalsLayout} wrap={false}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatPdfMoney(input.subtotal, input.currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>
                {formatPdfMoney(input.discountTotal, input.currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>
                {formatPdfMoney(input.taxTotal, input.currency)}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatPdfMoney(input.total, input.currency)}
              </Text>
            </View>
            {input.amountPaid ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Paid</Text>
                <Text style={styles.totalValue}>
                  {formatPdfMoney(input.amountPaid, input.currency)}
                </Text>
              </View>
            ) : null}
            {input.amountDue ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount due</Text>
                <Text style={styles.totalValue}>
                  {formatPdfMoney(input.amountDue, input.currency)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {renderTaxBreakdown(input.taxBreakdown ?? [], input.currency)}

        <View style={styles.informationGrid} wrap={false}>
          {input.remitTo ? (
            <View style={styles.informationBlock}>
              <Text style={styles.informationTitle}>
                {cleanPdfText(input.remitTo.label) || 'Remit to'}
              </Text>
              <Text style={styles.informationText}>
                {input.remitTo.lines
                  .map((line) => cleanPdfText(line))
                  .filter(Boolean)
                  .join('\n')}
              </Text>
            </View>
          ) : null}
          {input.notes ? (
            <View style={styles.informationBlock}>
              <Text style={styles.informationTitle}>Notes</Text>
              <Text style={styles.informationText}>{cleanPdfText(input.notes)}</Text>
            </View>
          ) : null}
          {input.termsAndConditions ? (
            <View style={styles.informationBlock}>
              <Text style={styles.informationTitle}>Terms and conditions</Text>
              <Text style={styles.informationText}>{cleanPdfText(input.termsAndConditions)}</Text>
            </View>
          ) : null}
        </View>

        {input.footerText ? (
          <Text style={styles.informationText} wrap={false}>
            {cleanPdfText(input.footerText)}
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{cleanPdfText(input.company.name)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
