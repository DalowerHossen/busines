// src/features/invoices/actions/delete-invoice.ts
// Removes a draft invoice from the lists. An issued invoice is never deleted:
// the numbering must stay unbroken, so it is cancelled instead.

'use server';

import { revalidatePath } from 'next/cache';

import { invoiceIdSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteInvoiceResult {
  /** Identifier of the invoice that was removed. */
  invoiceId: string;
}

export const deleteInvoice = createAction(
  invoiceIdSchema,
  async (input): Promise<DeleteInvoiceResult> => {
    const { user, company } = await requirePermission('invoices', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('invoices')
      .select('id, status, is_locked')
      .eq('company_id', company.id)
      .eq('id', input.invoiceId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That invoice no longer exists.');
    }

    if (readBoolean(current, 'is_locked') || readString(current, 'status') !== 'draft') {
      throw new AppError(
        'conflict',
        'An issued invoice cannot be deleted, because the numbering has to stay unbroken. Cancel it instead.'
      );
    }

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.invoiceId);

    if (error) {
      logger.error('Could not delete a draft invoice', error, { companyId: company.id });

      throw new AppError('database_failure', 'The draft could not be removed just now.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'invoice',
      entityId: input.invoiceId,
      companyId: company.id,
      description: 'Draft invoice deleted.',
    });

    revalidatePath('/dashboard/invoices');

    return { invoiceId: input.invoiceId };
  },
  { name: 'deleteInvoice' }
);
