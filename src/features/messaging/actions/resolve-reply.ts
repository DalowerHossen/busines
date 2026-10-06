// src/features/messaging/actions/resolve-reply.ts
// Closing one incoming reply, with a note about what was done about it, so
// the list only ever holds the replies that still need somebody.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { resolveReplySchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ResolveReplyResult {
  /** True when the reply was open and has now been closed. */
  wasClosed: boolean;
}

export const resolveInboundReply = createAction(
  resolveReplySchema,
  async (input): Promise<ResolveReplyResult> => {
    const { company } = await requirePermission('clients', 'edit');
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('mark_inbound_handled', {
      p_inbound_id: input.inboundId,
      p_note: input.note ?? null,
    });

    if (error) {
      logger.error('A reply could not be closed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That reply could not be closed. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'inbound_message',
      entityId: input.inboundId,
      companyId: company.id,
      description: 'Dealt with an incoming reply',
    });

    revalidatePath(`${ROUTES.messages}/replies`);

    return { wasClosed: data === true };
  },
  { name: 'resolveInboundReply' }
);
