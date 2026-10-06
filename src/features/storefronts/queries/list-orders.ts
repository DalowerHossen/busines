// src/features/storefronts/queries/list-orders.ts
// Reading the orders the shops have sent and what became of them.

import type { StorefrontOrderRecord } from '@/features/storefronts/types';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Reads the shop orders of one business.
 *
 * @param companyId Business whose orders are being read.
 * @param connectionId Optional shop to narrow the list to.
 * @returns The orders, newest first.
 */
export async function loadStorefrontOrders(
  companyId: string,
  connectionId: string | null = null
): Promise<readonly StorefrontOrderRecord[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_storefront_orders', {
    p_company_id: companyId,
    p_connection_id: connectionId,
    p_limit: 100,
  });

  if (error) {
    logger.error('The shop orders could not be read', error, { companyId });

    return [];
  }

  return asRows(data).map((row) => ({
    orderId: readString(row, 'order_id') ?? '',
    connectionId: readString(row, 'connection_id') ?? '',
    storeName: readString(row, 'store_name') ?? '',
    externalOrderId: readString(row, 'external_order_id') ?? '',
    externalOrderNumber: readString(row, 'external_order_number'),
    customerEmail: readString(row, 'customer_email'),
    customerName: readString(row, 'customer_name'),
    currency: readString(row, 'currency') ?? 'USD',
    totalAmount: readString(row, 'total_amount') ?? '0',
    status: readString(row, 'status') ?? 'received',
    invoiceId: readString(row, 'invoice_id'),
    invoiceNumber: readString(row, 'invoice_number'),
    balanceDue: readString(row, 'balance_due'),
    paidAt: readString(row, 'paid_at'),
    createdAt: readString(row, 'created_at') ?? '',
  }));
}
