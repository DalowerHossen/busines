// src/features/payments/queries/open-invoices.ts
// The invoices a payment can be applied to: issued, not settled and not
// cancelled, oldest first so the longest wait is cleared first.

import type { OpenInvoiceOption, PaymentFormData } from '@/features/payments/types';
import { OPEN_INVOICE_STATUSES } from '@/features/invoices/status';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How many open invoices the picker offers at once. */
const INVOICE_LIMIT = 300;

/**
 * Reads the invoices that still have a balance.
 *
 * @param companyId Company the payment belongs to.
 * @returns The invoices a payment can be applied to.
 */
export async function loadOpenInvoices(companyId: string): Promise<PaymentFormData> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, client_id, currency, balance_due, due_date, clients(display_name)')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .in('status', [...OPEN_INVOICE_STATUSES])
    .gt('balance_due', 0)
    .order('due_date', { ascending: true })
    .limit(INVOICE_LIMIT);

  if (error) {
    logger.error('Could not read the open invoices', error, { companyId });
    return { invoices: [] };
  }

  const invoices: OpenInvoiceOption[] = asRows(data)
    .map((row) => {
      const id = readString(row, 'id');
      const clientId = readString(row, 'client_id');

      if (id === null || clientId === null) {
        return null;
      }

      const joined = row['clients'];
      const clientName =
        joined !== null && typeof joined === 'object' && !Array.isArray(joined)
          ? ((joined as Record<string, unknown>)['display_name'] ?? null)
          : null;

      return {
        id,
        invoiceNumber: readString(row, 'invoice_number'),
        clientId,
        clientName: typeof clientName === 'string' ? clientName : 'Client removed',
        currency: readString(row, 'currency') ?? 'USD',
        balanceDue: readAmount(row, 'balance_due'),
        dueDate: readString(row, 'due_date') ?? '',
      };
    })
    .filter((entry): entry is OpenInvoiceOption => entry !== null);

  return { invoices };
}
