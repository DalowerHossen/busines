// src/features/recurring/queries/schedule-form-data.ts
// The draft invoices a schedule can copy. A template is a permanent draft: it
// is never issued itself, it is the shape of every invoice the schedule
// produces.

import type { ScheduleFormData, TemplateInvoiceOption } from '@/features/recurring/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How many drafts the template picker offers at once. */
const TEMPLATE_LIMIT = 200;

/**
 * Reads the draft invoices that can act as a template.
 *
 * @param companyId Company the schedule belongs to.
 * @param keepInvoiceId Template already chosen, kept in the list while editing.
 * @returns The templates on offer.
 */
export async function loadScheduleFormData(
  companyId: string,
  keepInvoiceId?: string
): Promise<ScheduleFormData> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, client_id, currency, total_amount, issue_date, clients(display_name)'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(TEMPLATE_LIMIT);

  if (error) {
    logger.error('Could not read the template invoices', error, { companyId });
    return { templates: [] };
  }

  const templates: TemplateInvoiceOption[] = asRows(data)
    .map((row) => {
      const id = readString(row, 'id');
      const clientId = readString(row, 'client_id');

      if (id === null || clientId === null) {
        return null;
      }

      const joined = row['clients'];
      const name =
        joined !== null && typeof joined === 'object' && !Array.isArray(joined)
          ? (joined as Record<string, unknown>)['display_name']
          : null;
      const clientName = typeof name === 'string' ? name : 'Client removed';
      const currency = readString(row, 'currency') ?? 'USD';
      const totalAmount = readAmount(row, 'total_amount');

      return {
        id,
        label: `${clientName} · ${totalAmount} ${currency}`,
        clientId,
        clientName,
        currency,
        totalAmount,
      };
    })
    .filter((entry): entry is TemplateInvoiceOption => entry !== null);

  if (keepInvoiceId === undefined || templates.some((entry) => entry.id === keepInvoiceId)) {
    return { templates };
  }

  const current = await supabase
    .from('invoices')
    .select('id, invoice_number, client_id, currency, total_amount, clients(display_name)')
    .eq('company_id', companyId)
    .eq('id', keepInvoiceId)
    .maybeSingle();

  if (current.error !== null || current.data === null) {
    return { templates };
  }

  const row = asRow(current.data);

  if (row === null) {
    return { templates };
  }

  const clientId = readString(row, 'client_id');
  const id = readString(row, 'id');

  if (id === null || clientId === null) {
    return { templates };
  }

  const joined = row['clients'];
  const name =
    joined !== null && typeof joined === 'object' && !Array.isArray(joined)
      ? (joined as Record<string, unknown>)['display_name']
      : null;
  const clientName = typeof name === 'string' ? name : 'Client removed';
  const currency = readString(row, 'currency') ?? 'USD';
  const totalAmount = readAmount(row, 'total_amount');

  return {
    templates: [
      {
        id,
        label: `${clientName} · ${totalAmount} ${currency}`,
        clientId,
        clientName,
        currency,
        totalAmount,
      },
      ...templates,
    ],
  };
}
