// src/features/portal/queries/resolve-portal-document.ts
// Turning the token in a client link into the one document it unlocks.
//
// The visitor has no account, so the read runs with the service role. Every
// rule about expiry, revocation and view limits lives in the database routine
// resolve_document_link, and nothing is read until that routine has approved
// the token.

import 'server-only';

import type {
  PortalBrand,
  PortalDocument,
  PortalEvidence,
  PortalLine,
  PortalParty,
  PortalResult,
} from '@/features/portal/types';
import { sha256Hex } from '@/lib/crypto/hashing';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { DatabaseRow } from '@/types/database';

const INVOICE_COLUMNS =
  'id, invoice_number, status, currency, issue_date, due_date, purchase_order_reference, subtotal_amount, line_discount_amount, document_discount_amount, tax_amount, shipping_amount, total_amount, paid_amount, balance_due, notes, terms_and_conditions, footer_note, bill_to, client_name_snapshot, company_profile_snapshot_id';

const INVOICE_LINE_COLUMNS =
  'id, line_number, description, long_description, quantity, unit_label, unit_price, discount_amount, tax_percentage, tax_amount, line_total';

const ESTIMATE_COLUMNS =
  'id, estimate_number, status, currency, issue_date, valid_until, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, notes, terms_and_conditions, footer_note, bill_to, client_name_snapshot';

const ESTIMATE_LINE_COLUMNS =
  'id, line_number, description, long_description, quantity, unit_label, unit_price, discount_amount, tax_percentage, tax_amount, line_total, is_selected';

const PROFILE_COLUMNS =
  'legal_name, trade_name, email, phone, website, address_line1, address_line2, city, state_region, postal_code, country_code, tax_registration_label, tax_id, logo_url, brand_primary_color, brand_accent_color, show_platform_badge, bank_name, bank_account_name, bank_account_number, bank_routing_number, bank_swift_code, bank_iban, remit_to_instructions';

/**
 * Builds the address block of a business or a client.
 *
 * @param source Record holding the address columns.
 * @param keys Column names in the order they should be printed.
 * @returns The lines that are not empty.
 */
function addressLines(source: DatabaseRow, keys: readonly string[]): readonly string[] {
  return keys
    .map((key) => readString(source, key))
    .filter((line): line is string => line !== null && line.trim().length > 0);
}

/**
 * Describes the business the way it should appear on the document.
 *
 * @param row Profile row, either live or frozen at the moment of issue.
 * @param fallbackName Name used when the business has no saved profile.
 * @returns The branding the page renders.
 */
function toBrand(row: DatabaseRow | null, fallbackName: string): PortalBrand {
  if (row === null) {
    return {
      legalName: fallbackName,
      tradeName: null,
      email: null,
      phone: null,
      website: null,
      addressLines: [],
      taxRegistrationLabel: 'Tax ID',
      taxId: null,
      logoUrl: null,
      primaryColor: '#1D4ED8',
      accentColor: '#0EA5E9',
      showPlatformBadge: true,
      bankName: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankRoutingNumber: null,
      bankSwiftCode: null,
      bankIban: null,
      remitToInstructions: null,
    };
  }

  return {
    legalName: readString(row, 'legal_name') ?? fallbackName,
    tradeName: readString(row, 'trade_name'),
    email: readString(row, 'email'),
    phone: readString(row, 'phone'),
    website: readString(row, 'website'),
    addressLines: addressLines(row, [
      'address_line1',
      'address_line2',
      'city',
      'state_region',
      'postal_code',
      'country_code',
    ]),
    taxRegistrationLabel: readString(row, 'tax_registration_label') ?? 'Tax ID',
    taxId: readString(row, 'tax_id'),
    logoUrl: readString(row, 'logo_url'),
    primaryColor: readString(row, 'brand_primary_color') ?? '#1D4ED8',
    accentColor: readString(row, 'brand_accent_color') ?? '#0EA5E9',
    showPlatformBadge: row['show_platform_badge'] !== false,
    bankName: readString(row, 'bank_name'),
    bankAccountName: readString(row, 'bank_account_name'),
    bankAccountNumber: readString(row, 'bank_account_number'),
    bankRoutingNumber: readString(row, 'bank_routing_number'),
    bankSwiftCode: readString(row, 'bank_swift_code'),
    bankIban: readString(row, 'bank_iban'),
    remitToInstructions: readString(row, 'remit_to_instructions'),
  };
}

/**
 * Reads the client block stored on the document.
 *
 * @param value The bill_to payload of the document.
 * @param fallbackName Name captured when the document was created.
 * @returns The client block the page renders.
 */
function toParty(value: unknown, fallbackName: string | null): PortalParty {
  const row = asRow(value);

  if (row === null) {
    return { name: fallbackName, attentionTo: null, email: null, addressLines: [], taxId: null };
  }

  return {
    name: readString(row, 'name') ?? fallbackName,
    attentionTo: readString(row, 'attention_to'),
    email: readString(row, 'email'),
    addressLines: addressLines(row, [
      'address_line1',
      'address_line2',
      'city',
      'state_region',
      'postal_code',
      'country_code',
    ]),
    taxId: readString(row, 'tax_id'),
  };
}

/**
 * Maps one printed line of a document.
 *
 * @param row Row read from invoice_items or estimate_items.
 * @returns The line the page renders.
 */
function toLine(row: DatabaseRow): PortalLine {
  return {
    id: readString(row, 'id') ?? '',
    description: readString(row, 'description') ?? '',
    longDescription: readString(row, 'long_description'),
    quantity: readAmount(row, 'quantity'),
    unitLabel: readString(row, 'unit_label'),
    unitPrice: readAmount(row, 'unit_price'),
    discountAmount: readAmount(row, 'discount_amount'),
    taxPercentage: readAmount(row, 'tax_percentage'),
    taxAmount: readAmount(row, 'tax_amount'),
    lineTotal: readAmount(row, 'line_total'),
  };
}

/**
 * Builds the failure a visitor sees when a link cannot be opened.
 *
 * @param message Message raised by the database routine.
 * @returns The failure the page renders.
 */
function toFailure(message: string): PortalResult {
  const normalised = message.toLowerCase();

  if (normalised.includes('expired')) {
    return {
      isAvailable: false,
      reason: 'expired',
      message: 'This link has expired. Ask the sender for a new one.',
    };
  }

  if (normalised.includes('revoked')) {
    return {
      isAvailable: false,
      reason: 'revoked',
      message: 'This link has been withdrawn by the sender.',
    };
  }

  if (normalised.includes('already been used')) {
    return {
      isAvailable: false,
      reason: 'used',
      message: 'This link has already been used as many times as it was allowed.',
    };
  }

  return {
    isAvailable: false,
    reason: 'invalid',
    message: 'This link is not valid. Check that you copied the whole address.',
  };
}

/**
 * Opens the document behind a client link.
 *
 * @param token Token taken from the address bar.
 * @returns The document, or the reason it cannot be shown.
 */
export async function resolvePortalDocument(token: string): Promise<PortalResult> {
  if (token.length < 20 || token.length > 400) {
    return toFailure('not valid');
  }

  const supabase = getServiceSupabaseClient();
  const context = getRequestContext();

  const { data: resolved, error: resolveError } = await supabase.rpc('resolve_document_link', {
    p_token_hash: sha256Hex(token),
    p_ip_address: context.ipAddress,
    p_user_agent: context.userAgent,
  });

  if (resolveError) {
    return toFailure(resolveError.message);
  }

  const link = asRows(resolved)[0];

  if (!link) {
    return toFailure('not valid');
  }

  const companyId = readString(link, 'company_id') ?? '';
  const documentId = readString(link, 'document_id') ?? '';
  const kind = readString(link, 'document_kind');

  if (kind !== 'invoice' && kind !== 'estimate') {
    return {
      isAvailable: false,
      reason: 'unavailable',
      message: 'This kind of document cannot be opened in a browser yet.',
    };
  }

  const [companyResult, profileResult] = await Promise.all([
    supabase.from('companies').select('display_name, legal_name').eq('id', companyId).maybeSingle(),
    supabase
      .from('company_profiles')
      .select(PROFILE_COLUMNS)
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);

  const companyRow = asRow(companyResult.data);
  const fallbackName =
    readString(companyRow ?? {}, 'legal_name') ??
    readString(companyRow ?? {}, 'display_name') ??
    'Your supplier';
  const brand = toBrand(asRow(profileResult.data), fallbackName);

  if (kind === 'invoice') {
    const [invoiceResult, lineResult, evidenceResult] = await Promise.all([
      supabase.from('invoices').select(INVOICE_COLUMNS).eq('id', documentId).maybeSingle(),
      supabase
        .from('invoice_items')
        .select(INVOICE_LINE_COLUMNS)
        .eq('invoice_id', documentId)
        .order('line_number', { ascending: true }),
      supabase.rpc('client_work_evidence', { p_invoice_id: documentId }),
    ]);

    // Proof of the delivered work sits beside the pay button. A client who
    // can see what they are paying for rarely needs to ask.
    const evidence: readonly PortalEvidence[] = asRows(evidenceResult.data).map((entry) => ({
      evidenceId: readString(entry, 'evidence_id') ?? '',
      kind: readString(entry, 'kind') ?? 'note',
      title: readString(entry, 'title') ?? '',
      description: readString(entry, 'description'),
      fileId: readString(entry, 'file_id'),
      fileName: readString(entry, 'file_name'),
      byteSize: Number(entry['byte_size'] ?? 0) || 0,
      externalUrl: readString(entry, 'external_url'),
      hoursWorked: entry['hours_worked'] === null ? null : readAmount(entry, 'hours_worked'),
      performedOn: readString(entry, 'performed_on'),
    }));

    const row = asRow(invoiceResult.data);

    if (invoiceResult.error || row === null) {
      logger.error(
        'A client link pointed at an invoice that could not be read',
        invoiceResult.error,
        {
          companyId,
          documentId,
        }
      );

      return {
        isAvailable: false,
        reason: 'unavailable',
        message: 'This document is not available at the moment. Please try again shortly.',
      };
    }

    const document: PortalDocument = {
      kind: 'invoice',
      id: documentId,
      number: readString(row, 'invoice_number') ?? 'Draft',
      status: readString(row, 'status') ?? 'sent',
      currency: readString(row, 'currency') ?? 'USD',
      issueDate: readString(row, 'issue_date') ?? '',
      dueDate: readString(row, 'due_date'),
      validUntil: null,
      purchaseOrderReference: readString(row, 'purchase_order_reference'),
      subtotalAmount: readAmount(row, 'subtotal_amount'),
      discountAmount: readAmount(row, 'document_discount_amount'),
      taxAmount: readAmount(row, 'tax_amount'),
      shippingAmount: readAmount(row, 'shipping_amount'),
      totalAmount: readAmount(row, 'total_amount'),
      paidAmount: readAmount(row, 'paid_amount'),
      balanceDue: readAmount(row, 'balance_due'),
      notes: readString(row, 'notes'),
      termsAndConditions: readString(row, 'terms_and_conditions'),
      footerNote: readString(row, 'footer_note'),
      billTo: toParty(row['bill_to'], readString(row, 'client_name_snapshot')),
      brand,
      lines: asRows(lineResult.data).map(toLine),
      evidence,
    };

    return { isAvailable: true, document };
  }

  const [estimateResult, lineResult] = await Promise.all([
    supabase.from('estimates').select(ESTIMATE_COLUMNS).eq('id', documentId).maybeSingle(),
    supabase
      .from('estimate_items')
      .select(ESTIMATE_LINE_COLUMNS)
      .eq('estimate_id', documentId)
      .order('line_number', { ascending: true }),
  ]);

  const row = asRow(estimateResult.data);

  if (estimateResult.error || row === null) {
    logger.error(
      'A client link pointed at an estimate that could not be read',
      estimateResult.error,
      {
        companyId,
        documentId,
      }
    );

    return {
      isAvailable: false,
      reason: 'unavailable',
      message: 'This document is not available at the moment. Please try again shortly.',
    };
  }

  const lines = asRows(lineResult.data).filter((line) => line['is_selected'] !== false);

  const document: PortalDocument = {
    kind: 'estimate',
    id: documentId,
    number: readString(row, 'estimate_number') ?? 'Draft',
    status: readString(row, 'status') ?? 'sent',
    currency: readString(row, 'currency') ?? 'USD',
    issueDate: readString(row, 'issue_date') ?? '',
    dueDate: null,
    validUntil: readString(row, 'valid_until'),
    purchaseOrderReference: null,
    subtotalAmount: readAmount(row, 'subtotal_amount'),
    discountAmount: readAmount(row, 'discount_amount'),
    taxAmount: readAmount(row, 'tax_amount'),
    shippingAmount: readAmount(row, 'shipping_amount'),
    totalAmount: readAmount(row, 'total_amount'),
    paidAmount: '0.00',
    balanceDue: readAmount(row, 'total_amount'),
    notes: readString(row, 'notes'),
    termsAndConditions: readString(row, 'terms_and_conditions'),
    footerNote: readString(row, 'footer_note'),
    billTo: toParty(row['bill_to'], readString(row, 'client_name_snapshot')),
    brand,
    lines: lines.map(toLine),
    evidence: [],
  };

  return { isAvailable: true, document };
}
