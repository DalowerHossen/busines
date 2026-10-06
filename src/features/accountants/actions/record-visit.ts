// src/features/accountants/actions/record-visit.ts
// Stamping the moment a bookkeeper opened one of the businesses they serve.
// The owner who granted the access can see that stamp, which is the point:
// access to somebody else's books should never be silent.

'use server';

import { workspaceVisitSchema } from '@/features/accountants/validation/accountant';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireRole } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RecordVisitResult {
  /** True when the grant was found and stamped. */
  isRecorded: boolean;
}

export const recordWorkspaceVisit = createAction(
  workspaceVisitSchema,
  async (input): Promise<RecordVisitResult> => {
    await requireRole(['accountant']);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('touch_accountant_access', {
      p_company_id: input.companyId,
    });

    if (error) {
      logger.error('The bookkeeping visit could not be recorded', error, {
        companyId: input.companyId,
      });

      throw new AppError('database_failure', 'That business could not be opened. Please retry.');
    }

    if (data !== true) {
      throw new AppError('forbidden', 'You no longer have access to that business.');
    }

    await recordAuditEntry({
      action: 'view_sensitive',
      entityType: 'company',
      entityId: input.companyId,
      companyId: input.companyId,
      description: 'An accountant opened the books of this business.',
    });

    return { isRecorded: true };
  },
  { name: 'recordWorkspaceVisit' }
);
