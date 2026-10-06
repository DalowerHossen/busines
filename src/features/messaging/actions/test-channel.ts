// src/features/messaging/actions/test-channel.ts
// Proving a channel works before anybody relies on it. The credentials are
// decrypted for this call only, nothing is sent to a client, and the result
// is written beside the channel so the whole team can see it.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { channelIdSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { resolveChannelCredentials } from '@/lib/messaging/credentials';
import { isOutboundChannel, messagingAdapterFor } from '@/lib/messaging/providers/registry';
import { asRow, readJson, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface TestChannelResult {
  /** True when the provider answered as expected. */
  isHealthy: boolean;
  /** A sentence the owner can act on. */
  message: string;
}

export const testMessagingChannel = createAction(
  channelIdSchema,
  async (input): Promise<TestChannelResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('messaging_channels')
      .select(
        'id, channel, provider, sender_number, sender_handle, credential_id, adapter_settings'
      )
      .eq('id', input.channelId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const row = asRow(data);

    if (error || row === null) {
      throw new AppError('not_found', 'That channel could not be found.');
    }

    const channel = readString(row, 'channel') ?? '';

    if (!isOutboundChannel(channel)) {
      throw new AppError('validation_failed', 'That channel cannot be tested from here.');
    }

    const provider = readString(row, 'provider') ?? 'configurable';
    const resolved = await resolveChannelCredentials(readString(row, 'credential_id'), provider);

    const outcome = await messagingAdapterFor(channel, provider).testConnection({
      provider,
      channel,
      credentials: resolved.credentials,
      settings: { ...resolved.settings, ...readJson(row, 'adapter_settings') },
      senderAddress: readString(row, 'sender_number') ?? readString(row, 'sender_handle'),
    });

    // Only the platform may declare a channel proven, so the result is
    // written with the service identity rather than the owner's.
    const service = getServiceSupabaseClient();
    const { error: writeError } = await service.rpc('record_channel_test', {
      p_channel_id: input.channelId,
      p_is_healthy: outcome.isHealthy,
      p_message: outcome.message,
    });

    if (writeError) {
      logger.error('The result of a channel test could not be stored', writeError, {
        companyId: company.id,
      });
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'messaging_channel',
      entityId: input.channelId,
      companyId: company.id,
      description: outcome.isHealthy
        ? 'Tested a messaging channel and it answered'
        : 'Tested a messaging channel and it refused',
      metadata: { channel, provider },
    });

    revalidatePath(`${ROUTES.messages}/channels`);

    return outcome;
  },
  { name: 'testMessagingChannel' }
);
