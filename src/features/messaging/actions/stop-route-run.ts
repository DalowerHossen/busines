// src/features/messaging/actions/stop-route-run.ts
// Calling off a chain. Somebody has spoken to the client, so nothing further
// should be sent about the same thing.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { stopRunSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StopRouteRunResult {
  /** True when the chain was running and has now been stopped. */
  wasStopped: boolean;
}

export const stopRouteRun = createAction(
  stopRunSchema,
  async (input): Promise<StopRouteRunResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('stop_message_route_run', {
      p_run_id: input.runId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A fallback chain could not be stopped', error, { companyId: company.id });

      throw new AppError('database_failure', 'That chain could not be stopped. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'message_route_run',
      entityId: input.runId,
      companyId: company.id,
      description: 'Stopped a fallback chain',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.messages}/routes`);

    return { wasStopped: data === true };
  },
  { name: 'stopRouteRun' }
);
