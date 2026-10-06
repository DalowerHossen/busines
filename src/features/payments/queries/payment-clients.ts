// src/features/payments/queries/payment-clients.ts
// The client list used by the filter bar above the payment list.

import type { PaymentClientOption } from '@/features/payments/types';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How many clients the filter offers at once. */
const CLIENT_LIMIT = 500;

/**
 * Reads the clients that can be filtered on.
 *
 * @param companyId Company whose clients are read.
 * @returns The clients, sorted by name.
 */
export async function loadPaymentClients(companyId: string): Promise<PaymentClientOption[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('clients')
    .select('id, display_name')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
    .limit(CLIENT_LIMIT);

  if (error) {
    logger.error('Could not read the clients for the payment filters', error, { companyId });
    return [];
  }

  return asRows(data)
    .map((row) => {
      const id = readString(row, 'id');
      const name = readString(row, 'display_name');

      if (id === null || name === null) {
        return null;
      }

      return { id, name };
    })
    .filter((entry): entry is PaymentClientOption => entry !== null);
}
