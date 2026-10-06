// src/features/invoices/actions/restore-invoice.ts
// Brings a deleted draft invoice back into the working lists.

'use server';

import { revalidatePath } from 'next/cache';

import { invoiceIdSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreInvoiceResult {
  /** Identifier of the invoice that was brought back. */
  invoiceId: string;
}

export const restoreInvoice = createAction(
  invoiceIdSchema,
  async (input): Promise<RestoreInvoiceResult> => {
    const { user, company } = await requirePermission('invoices', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('invoices')
      .update({ deleted_at: null, updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.invoiceId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore an invoice', error, { companyId: company.id });

      throw new AppError('database_failure', 'The invoice could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That invoice is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'restore',
      entityType: 'invoice',
      entityId: input.invoiceId,
      companyId: company.id,
      description: 'Draft invoice restored.',
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { invoiceId: input.invoiceId };
  },
  { name: 'restoreInvoice' }
);
