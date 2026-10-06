// src/features/estimates/queries/get-estimate.ts
// Reading one estimate with its lines, in the order they are printed.

import { toEstimateDetail } from '@/features/estimates/mappers';
import type { EstimateDetail } from '@/features/estimates/types';
import { logger } from '@/lib/logger';
import { asRow, asRows } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, estimate_number, status, title, client_id, client_name_snapshot, bill_to, currency, issue_date, valid_until, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, notes, terms_and_conditions, footer_note, sent_at, first_viewed_at, last_viewed_at, view_count, approved_at, approved_by_name, declined_at, decline_reason, converted_at, converted_invoice_id, created_at, deleted_at, clients(display_name, email)';

const LINE_COLUMNS =
  'id, line_number, description, long_description, quantity, unit_label, unit_price, discount_value, discount_amount, tax_percentage, tax_name_snapshot, tax_amount, line_subtotal, line_total, product_id, tax_rate_id, is_optional, is_selected';

/**
 * Reads one estimate of a company with its lines.
 *
 * @param companyId Company the estimate must belong to.
 * @param estimateId Estimate being opened.
 * @returns The estimate, or null when it does not exist.
 */
export async function getEstimate(
  companyId: string,
  estimateId: string
): Promise<EstimateDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('estimates')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', estimateId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read an estimate', error, { companyId, estimateId });
    return null;
  }

  const row = asRow(data);

  if (row === null) {
    return null;
  }

  const lines = await supabase
    .from('estimate_items')
    .select(LINE_COLUMNS)
    .eq('company_id', companyId)
    .eq('estimate_id', estimateId)
    .is('deleted_at', null)
    .order('line_number', { ascending: true });

  if (lines.error) {
    logger.error('Could not read the estimate lines', lines.error, { companyId, estimateId });
  }

  return toEstimateDetail(row, asRows(lines.data));
}
