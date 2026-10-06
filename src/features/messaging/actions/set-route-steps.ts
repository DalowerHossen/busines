// src/features/messaging/actions/set-route-steps.ts
// Laying out the order a chain tries its channels in. The whole chain is
// replaced in one go, because an order with a gap in it is not an order
// anybody can reason about.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { routeStepsSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetRouteStepsResult {
  /** How many channels the chain now tries. */
  stepCount: number;
}

export const setMessageRouteSteps = createAction(
  routeStepsSchema,
  async (input): Promise<SetRouteStepsResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const steps = input.steps.map((step) => ({
      channel: step.channel,
      template_key: step.templateKey ?? null,
      wait_minutes: step.waitMinutes,
      is_required: step.isRequired,
    }));

    const { data, error } = await supabase.rpc('set_message_route_steps', {
      p_route_id: input.routeId,
      p_steps: steps,
    });

    if (error || typeof data !== 'number') {
      logger.error('The channels of a chain could not be saved', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The order could not be saved. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'message_route',
      entityId: input.routeId,
      companyId: company.id,
      description: `Set a fallback chain to try ${data} channels`,
      metadata: { stepCount: data },
    });

    revalidatePath(`${ROUTES.messages}/routes`);

    return { stepCount: data };
  },
  { name: 'setMessageRouteSteps' }
);
