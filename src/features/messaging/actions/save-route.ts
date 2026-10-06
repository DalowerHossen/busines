// src/features/messaging/actions/save-route.ts
// Creating or editing a fallback chain: what it is called, when it stops,
// and whether it insists on consent before it uses a channel.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveRouteSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveRouteResult {
  /** Identifier of the chain that was created or edited. */
  routeId: string;
}

export const saveMessageRoute = createAction(
  saveRouteSchema,
  async (input): Promise<SaveRouteResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_message_route', {
      p_company_id: company.id,
      p_route_key: input.routeKey,
      p_name: input.name,
      p_description: input.description ?? null,
      p_notification_kind: null,
      p_is_active: input.isActive,
      p_stop_on_delivery: input.stopOnDelivery,
      p_stop_on_engagement: input.stopOnEngagement,
      p_respect_quiet_hours: input.respectQuietHours,
      p_requires_consent: input.requiresConsent,
      p_max_total_cost: null,
      p_cost_currency: company.baseCurrency,
    });

    if (error || typeof data !== 'string') {
      logger.error('A fallback chain could not be saved', error, { companyId: company.id });

      throw new AppError('database_failure', 'That chain could not be saved. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'message_route',
      entityId: data,
      companyId: company.id,
      description: `Saved the fallback chain ${input.name}`,
      metadata: { routeKey: input.routeKey },
    });

    revalidatePath(`${ROUTES.messages}/routes`);

    return { routeId: data };
  },
  { name: 'saveMessageRoute' }
);
