// src/features/storefronts/actions/issue-key.ts
// Issuing the key a shop sends with every request.
//
// The key is generated here, shown to the owner once and then forgotten: only
// its hash reaches the database. The key it replaces keeps working for five
// minutes so a shop in the middle of a checkout is never cut off.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { issueKeySchema } from '@/features/storefronts/validation/storefronts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { encryptSecret } from '@/lib/crypto/encryption';
import { randomSecret, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface IssueKeyResult {
  /** The key itself, which is never shown again. */
  storeKey: string;
  /** The secret the shop signs its notifications with. */
  webhookSecret: string;
  /** Last characters of the key, kept for recognition. */
  maskedHint: string;
}

export const issueStorefrontKey = createAction(
  issueKeySchema,
  async (input): Promise<IssueKeyResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const storeKey = `sk_store_${randomSecret(24)}`;
    const webhookSecret = randomSecret(32);
    const maskedHint = storeKey.slice(-4);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('issue_storefront_key', {
      p_connection_id: input.connectionId,
      p_key_hash: sha256Hex(storeKey),
      p_masked_hint: maskedHint,
      p_webhook_secret_encrypted: encryptSecret(webhookSecret),
    });

    if (error) {
      logger.error('A shop key could not be issued', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'storefront_connection',
      entityId: input.connectionId,
      companyId: company.id,
      description: 'Issued a new shop key',
      metadata: { hint: maskedHint },
    });

    revalidatePath(`${ROUTES.settings}/storefronts`);

    return { storeKey, webhookSecret, maskedHint };
  },
  { name: 'issueStorefrontKey' }
);
