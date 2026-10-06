// src/features/clients/actions/delete-client.ts
// Removes a client from the lists without losing the record. The row keeps its
// history and can be brought back, and a client that already carries invoices
// is archived rather than deleted.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { clientIdSchema } from '@/features/clients/validation/client';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteClientResult {
  /** True when the client was archived instead, because invoices exist. */
  wasArchived: boolean;
}

export const deleteClient = createAction(
  clientIdSchema,
  async (input): Promise<DeleteClientResult> => {
    const { user, company } = await requirePermission('clients', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { count, error: countError } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('client_id', input.clientId)
      .is('deleted_at', null);

    if (countError) {
      logger.error('Could not check invoices before deleting a client', countError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The client could not be removed just now.');
    }

    const hasInvoices = (count ?? 0) > 0;
    const patch = hasInvoices
      ? { status: 'archived' as const, updated_by: user.id }
      : { deleted_at: new Date().toISOString(), status: 'archived' as const, updated_by: user.id };

    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('company_id', company.id)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not remove a client', error, { companyId: company.id });

      throw new AppError('database_failure', 'The client could not be removed just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That client no longer exists.');
    }

    await recordAuditEntry({
      action: hasInvoices ? 'update' : 'soft_delete',
      entityType: 'client',
      entityId: input.clientId,
      companyId: company.id,
      description: hasInvoices
        ? 'Client archived because invoices are held against it.'
        : 'Client deleted.',
    });

    revalidatePath(ROUTES.clients);

    return { wasArchived: hasInvoices };
  },
  { name: 'deleteClient' }
);
