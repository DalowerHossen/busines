// src/features/instalments/actions/create-plan.ts
// Agreeing that one invoice will be paid in parts. The schedule is built in
// the database from the terms, so the figures can never drift from them.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { createPlanSchema } from '@/features/instalments/validation/instalments';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreatePlanResult {
  /** Identifier of the plan that was created. */
  planId: string;
}

export const createInstalmentPlan = createAction(
  createPlanSchema,
  async (input): Promise<CreatePlanResult> => {
    const { company } = await requirePermission('payments', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('create_instalment_plan', {
      p_invoice_id: input.invoiceId,
      p_offer_id: input.offerId,
      p_first_due_date: input.firstDueDate ?? null,
    });

    if (error || typeof data !== 'string') {
      logger.error('An instalment plan could not be created', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That plan could not be agreed. Try again.'
      );
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'instalment_plan',
      entityId: data,
      companyId: company.id,
      description: 'Agreed that an invoice will be paid in parts',
      metadata: { invoiceId: input.invoiceId },
    });

    revalidatePath(`${ROUTES.payments}/instalments`);
    revalidatePath(`${ROUTES.invoices}/${input.invoiceId}`);

    return { planId: data };
  },
  { name: 'createInstalmentPlan' }
);
