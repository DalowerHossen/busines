// src/features/gateways/actions/set-gateway-state.ts
// Turning a connection on or off, and choosing which one clients are offered
// first. Only one connection can be the default at a time.

'use server';

import { revalidatePath } from 'next/cache';

import { setGatewayStateSchema } from '@/features/gateways/validation/gateway';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SetGatewayStateResult {
  /** Identifier of the connection that changed. */
  gatewayId: string;
}

export const setGatewayState = createAction(
  setGatewayStateSchema,
  async (input): Promise<SetGatewayStateResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const changes: Record<string, Json> = { updated_by: user.id };

    if (input.isEnabled !== undefined) {
      changes['is_enabled'] = input.isEnabled;

      if (!input.isEnabled) {
        changes['is_default'] = false;
      }
    }

    if (input.makeDefault) {
      const { error: clearError } = await supabase
        .from('payment_gateways')
        .update({ is_default: false, updated_by: user.id })
        .eq('company_id', company.id)
        .eq('owner_type', 'company');

      if (clearError) {
        logger.error('Could not move the default connection', clearError, {
          companyId: company.id,
        });

        throw new AppError('database_failure', 'The default could not be changed.');
      }

      changes['is_default'] = true;
      changes['is_enabled'] = true;
    }

    const { error } = await supabase
      .from('payment_gateways')
      .update(changes)
      .eq('id', input.gatewayId)
      .eq('company_id', company.id);

    if (error) {
      logger.error('Could not change the payment connection', error, { companyId: company.id });

      throw new AppError('database_failure', 'The connection could not be changed.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'payment_gateway',
      entityId: input.gatewayId,
      companyId: company.id,
      description: input.makeDefault
        ? 'This connection is now offered to clients first.'
        : `The connection was turned ${input.isEnabled ? 'on' : 'off'}.`,
    });

    revalidatePath('/dashboard/settings/payments');

    return { gatewayId: input.gatewayId };
  },
  { name: 'setGatewayState' }
);
