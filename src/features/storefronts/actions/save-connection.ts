// src/features/storefronts/actions/save-connection.ts
// Connecting an online shop to this account, or changing how it is described.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveConnectionSchema } from '@/features/storefronts/validation/storefronts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveConnectionResult {
  /** Identifier of the shop that was saved. */
  connectionId: string;
}

export const saveStorefrontConnection = createAction(
  saveConnectionSchema,
  async (input): Promise<SaveConnectionResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_storefront_connection', {
      p_company_id: company.id,
      p_platform: input.platform,
      p_store_name: input.storeName,
      p_store_domain: input.storeDomain,
      p_connection_id: input.connectionId ?? null,
      p_notify_url: input.notifyUrl ?? null,
      p_default_currency: input.defaultCurrency,
      p_auto_issue_invoice: input.autoIssueInvoice,
    });

    if (error || typeof data !== 'string') {
      logger.error('A shop could not be connected', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That shop could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.connectionId === undefined ? 'insert' : 'update',
      entityType: 'storefront_connection',
      entityId: data,
      companyId: company.id,
      description:
        input.connectionId === undefined ? 'Connected an online shop' : 'Changed a shop connection',
      metadata: { platform: input.platform, domain: input.storeDomain },
    });

    revalidatePath(`${ROUTES.settings}/storefronts`);

    return { connectionId: data };
  },
  { name: 'saveStorefrontConnection' }
);
