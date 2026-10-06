// src/features/checkout/queries/get-checkout.ts
// Turning a payment link into the invoice behind it and the ways it can be
// paid.
//
// The visitor has no account, so the read runs with the service role and
// every rule about expiry and revocation is left to the database routine that
// resolves the token. Only the invoice that token unlocks is ever read.

import 'server-only';

import { GATEWAY_CATALOG } from '@/features/gateways/catalog';
import type {
  CheckoutInvoice,
  CheckoutMethod,
  CheckoutResult,
  CheckoutTerms,
} from '@/features/checkout/types';
import { sha256Hex } from '@/lib/crypto/hashing';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readEnum, readString } from '@/lib/records';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { GATEWAY_PROVIDERS } from '@/types/enums';
import { isJsonObject } from '@/types/json';

export interface ResolvedCheckoutLink {
  linkId: string;
  companyId: string;
  invoiceId: string;
  recipientEmail: string | null;
}

/**
 * Opens the link and reports which invoice it unlocks.
 *
 * @param token Token taken from the address bar.
 * @returns The invoice behind the link, or null when it cannot be opened.
 */
export async function resolveCheckoutLink(token: string): Promise<ResolvedCheckoutLink | null> {
  if (token.length < 20 || token.length > 400) {
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const context = getRequestContext();

  const { data, error } = await supabase.rpc('resolve_document_link', {
    p_token_hash: sha256Hex(token),
    p_ip_address: context.ipAddress,
    p_user_agent: context.userAgent,
  });

  if (error) {
    return null;
  }

  const link = asRows(data)[0];

  if (!link || readString(link, 'document_kind') !== 'invoice') {
    return null;
  }

  return {
    linkId: readString(link, 'link_id') ?? '',
    companyId: readString(link, 'company_id') ?? '',
    invoiceId: readString(link, 'document_id') ?? '',
    recipientEmail: readString(link, 'recipient_email'),
  };
}

/**
 * Describes one way the client may pay.
 *
 * @param row Row read from public.payment_gateways.
 * @returns The method the page offers.
 */
function toMethod(row: Parameters<typeof readString>[0]): CheckoutMethod {
  const provider = readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual');
  const definition = GATEWAY_CATALOG[provider];

  return {
    gatewayId: readString(row, 'id') ?? '',
    provider,
    label: definition.label,
    description: definition.description,
    instructions: readString(row, 'instructions'),
    redirectsAway: provider !== 'manual',
  };
}

/**
 * Builds everything the payment page shows.
 *
 * @param token Token taken from the address bar.
 * @returns The invoice and its payment methods, or why neither can be shown.
 */
export async function getCheckout(token: string): Promise<CheckoutResult> {
  const link = await resolveCheckoutLink(token);

  if (link === null) {
    return {
      isAvailable: false,
      message:
        'This payment link cannot be opened. It may have expired or been withdrawn, so ask the sender for a new one.',
    };
  }

  const supabase = getServiceSupabaseClient();

  const [invoiceResult, companyResult, gatewayResult, cardResult, preferenceResult] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, currency, balance_due, due_date, status, bill_to')
        .eq('id', link.invoiceId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('companies')
        .select('display_name, legal_name')
        .eq('id', link.companyId)
        .maybeSingle(),
      supabase
        .from('payment_gateways')
        .select('id, provider, instructions, supported_currencies, display_order')
        .eq('owner_type', 'company')
        .eq('company_id', link.companyId)
        .eq('is_enabled', true)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .order('display_order', { ascending: true }),
      supabase.rpc('card_payment_allowed', { p_invoice_id: link.invoiceId }),
      supabase.rpc('company_checkout_preferences', { p_company_id: link.companyId }),
    ]);

  const invoiceRow = asRow(invoiceResult.data);

  if (invoiceResult.error || invoiceRow === null) {
    logger.error(
      'A payment link pointed at an invoice that could not be read',
      invoiceResult.error,
      {
        companyId: link.companyId,
      }
    );

    return {
      isAvailable: false,
      message: 'This invoice is not available at the moment. Please try again shortly.',
    };
  }

  const currency = readString(invoiceRow, 'currency') ?? 'USD';
  const billTo = asRow(invoiceRow['bill_to']);
  const companyRow = asRow(companyResult.data);

  const invoice: CheckoutInvoice = {
    id: link.invoiceId,
    number: readString(invoiceRow, 'invoice_number') ?? 'Invoice',
    currency,
    balanceDue: readAmount(invoiceRow, 'balance_due'),
    dueDate: readString(invoiceRow, 'due_date'),
    payerEmail: link.recipientEmail ?? (billTo ? readString(billTo, 'email') : null),
    supplierName:
      readString(companyRow ?? {}, 'legal_name') ??
      readString(companyRow ?? {}, 'display_name') ??
      'Your supplier',
  };

  const cardDecision = isJsonObject(cardResult.data) ? cardResult.data : {};
  const isCardAllowed = cardDecision['is_allowed'] !== false;
  const preferences = isJsonObject(preferenceResult.data) ? preferenceResult.data : {};

  const terms: CheckoutTerms = {
    consentStatement:
      typeof preferences['consent_statement'] === 'string'
        ? preferences['consent_statement']
        : 'I confirm I ordered this work, that it has been delivered to my satisfaction, and I authorise this payment.',
    requireTermsAcceptance: preferences['require_terms_acceptance'] !== false,
    requireBillingAddress: preferences['require_billing_address'] !== false,
    requireDeliveryConfirmation: preferences['require_delivery_confirmation'] === true,
    refundWindowDays:
      typeof preferences['refund_window_days'] === 'number'
        ? preferences['refund_window_days']
        : 14,
  };

  const methods = asRows(gatewayResult.data)
    .filter((row) => {
      // A seller who has switched cards off, or set a ceiling this invoice
      // is above, is not offered a card route at all.
      if (!isCardAllowed && readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual') !== 'manual') {
        return false;
      }

      if (
        preferences['accept_bank_transfer'] === false &&
        readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual') === 'manual'
      ) {
        return false;
      }

      const currencies = row['supported_currencies'];

      if (!Array.isArray(currencies) || currencies.length === 0) {
        return true;
      }

      return currencies.includes(currency);
    })
    .map(toMethod);

  return {
    isAvailable: true,
    invoice,
    methods,
    isSettled: Number.parseFloat(invoice.balanceDue) <= 0,
    terms,
  };
}
