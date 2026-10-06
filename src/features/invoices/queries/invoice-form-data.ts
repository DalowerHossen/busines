// src/features/invoices/queries/invoice-form-data.ts
// The lists the invoice builder needs: the clients that can be billed, the
// catalogue to pick lines from and the tax rates that can be applied.

import type {
  InvoiceClientOption,
  InvoiceFormData,
  InvoiceProductOption,
  InvoiceTaxOption,
} from '@/features/invoices/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How many catalogue items the builder offers without a search. */
const PRODUCT_LIMIT = 200;

/**
 * Reads the clients, catalogue items and tax rates the builder offers.
 *
 * @param companyId Company the invoice is being raised for.
 * @returns The three lists, empty when they cannot be read.
 */
export async function loadInvoiceFormData(companyId: string): Promise<InvoiceFormData> {
  const supabase = createServerSupabaseClient();

  const [clients, products, taxRates] = await Promise.all([
    supabase
      .from('clients')
      .select('id, display_name, billing_currency, default_payment_terms_days, email')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('display_name', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, sku, unit_price, tax_rate_id, description')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(PRODUCT_LIMIT),
    supabase
      .from('tax_rates')
      .select('id, name, rate_percentage')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true }),
  ]);

  if (clients.error || products.error || taxRates.error) {
    logger.error(
      'Could not read the invoice builder lists',
      clients.error ?? products.error ?? taxRates.error,
      { companyId }
    );
  }

  const clientOptions: InvoiceClientOption[] = asRows(clients.data)
    .map((row) => {
      const id = readString(row, 'id');
      const name = readString(row, 'display_name');

      if (id === null || name === null) {
        return null;
      }

      return {
        id,
        name,
        currency: readString(row, 'billing_currency'),
        paymentTermsDays: readNumber(row, 'default_payment_terms_days'),
        email: readString(row, 'email'),
      };
    })
    .filter((entry): entry is InvoiceClientOption => entry !== null);

  const productOptions: InvoiceProductOption[] = asRows(products.data)
    .map((row) => {
      const id = readString(row, 'id');
      const name = readString(row, 'name');

      if (id === null || name === null) {
        return null;
      }

      return {
        id,
        name,
        sku: readString(row, 'sku'),
        unitPrice: readAmount(row, 'unit_price'),
        taxRateId: readString(row, 'tax_rate_id'),
        description: readString(row, 'description'),
      };
    })
    .filter((entry): entry is InvoiceProductOption => entry !== null);

  const taxOptions: InvoiceTaxOption[] = asRows(taxRates.data)
    .map((row) => {
      const id = readString(row, 'id');
      const name = readString(row, 'name');

      if (id === null || name === null) {
        return null;
      }

      return { id, name, percentage: readAmount(row, 'rate_percentage') };
    })
    .filter((entry): entry is InvoiceTaxOption => entry !== null);

  return { clients: clientOptions, products: productOptions, taxRates: taxOptions };
}
