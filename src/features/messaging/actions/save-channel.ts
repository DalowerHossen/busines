// src/features/messaging/actions/save-channel.ts
// Adding or editing a way of reaching people that is not email. A channel
// spends money every time it is used, so only the owner can touch it, and
// every change is written to the audit trail.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveChannelSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveChannelResult {
  /** Identifier of the channel that was created or edited. */
  channelId: string;
}

export const saveMessagingChannel = createAction(
  saveChannelSchema,
  async (input): Promise<SaveChannelResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_messaging_channel', {
      p_company_id: company.id,
      p_channel: input.channel,
      p_provider: input.provider,
      p_display_name: input.displayName,
      p_sender_number: input.senderNumber ?? null,
      p_sender_handle: input.senderHandle ?? null,
      p_sender_display_name: null,
      p_credential_id: null,
      p_cost_per_message: input.costPerMessage,
      p_cost_currency: input.costCurrency,
      p_daily_send_limit: input.dailySendLimit ?? null,
      p_routing_priority: input.routingPriority,
      p_quiet_hours_start: input.quietHoursStart ?? null,
      p_quiet_hours_end: input.quietHoursEnd ?? null,
      p_adapter_settings: input.adapterSettings,
    });

    if (error || typeof data !== 'string') {
      logger.error('A messaging channel could not be saved', error, { companyId: company.id });

      throw new AppError('database_failure', 'That channel could not be saved. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'messaging_channel',
      entityId: data,
      companyId: company.id,
      description: `Saved the ${input.channel} channel ${input.displayName}`,
      metadata: { provider: input.provider, channel: input.channel },
    });

    revalidatePath(`${ROUTES.messages}/channels`);

    return { channelId: data };
  },
  { name: 'saveMessagingChannel' }
);
