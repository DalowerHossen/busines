// src/features/payouts/actions/save-payout-account.ts
// Saving where the money should be sent. The account number is encrypted
// before it is stored and only its last four characters are kept in clear, so
// the destination can be recognised without being readable.

'use server';

import { revalidatePath } from 'next/cache';

import { savePayoutAccountSchema } from '@/features/payouts/validation/payout';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SavePayoutAccountResult {
  /** Identifier of the destination that was stored. */
  accountId: string;
}

export const savePayoutAccount = createAction(
  savePayoutAccountSchema,
  async (input): Promise<SavePayoutAccountResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('id')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const wallet = asRow(walletData);

    if (walletError || wallet === null) {
      throw new AppError(
        'not_found',
        'This business has no wallet yet, so there is nothing to pay out.'
      );
    }

    const walletId = readString(wallet, 'id') ?? '';
    const digits = input.accountNumber.replace(/\s+/g, '');

    const changes: Record<string, Json> = {
      wallet_id: walletId,
      company_id: company.id,
      label: input.label,
      method: input.method,
      account_holder_name: input.accountHolderName,
      account_details_encrypted: encryptCredentialBundle({
        account_number: digits,
        ...(input.routingNumber ? { routing_number: input.routingNumber } : {}),
      }),
      account_mask: `****${digits.slice(-4)}`,
      bank_name: input.bankName,
      currency: input.currency,
      country_code: input.countryCode,
      updated_by: user.id,
    };

    if (input.makeDefault) {
      const { error: clearError } = await supabase
        .from('payout_accounts')
        .update({ is_default: false, updated_by: user.id })
        .eq('wallet_id', walletId);

      if (clearError) {
        logger.error('The default destination could not be moved', clearError, {
          companyId: company.id,
        });

        throw new AppError('database_failure', 'The destination could not be saved.');
      }

      changes['is_default'] = true;
    }

    const query = input.accountId
      ? supabase
          .from('payout_accounts')
          .update(changes)
          .eq('id', input.accountId)
          .eq('wallet_id', walletId)
          .select('id')
          .single()
      : supabase
          .from('payout_accounts')
          .insert({ ...changes, created_by: user.id })
          .select('id')
          .single();

    const { data, error } = await query;
    const stored = asRow(data);

    if (error || stored === null) {
      logger.error('A payout destination could not be saved', error, { companyId: company.id });

      throw new AppError('database_failure', 'The destination could not be saved.');
    }

    const accountId = readString(stored, 'id') ?? '';

    await recordAuditEntry({
      action: input.accountId ? 'update' : 'insert',
      entityType: 'payout_account',
      entityId: accountId,
      companyId: company.id,
      description: `Payout destination ${input.label} saved.`,
    });

    revalidatePath('/dashboard/payouts');

    return { accountId };
  },
  { name: 'savePayoutAccount' }
);
