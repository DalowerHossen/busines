// src/features/accountants/actions/grant-access.ts
// Letting an accountant into the books. The person has to hold an accountant
// login already, because access to a set of books is given to somebody who
// has accepted the terms of one, not to an email address.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { grantAccountantAccessSchema } from '@/features/accountants/validation/accountant';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface GrantAccessResult {
  /** Identifier of the grant that now exists. */
  grantId: string;
  /** Name of the accountant who was let in. */
  accountantName: string;
}

export const grantAccountantAccess = createAction(
  grantAccountantAccessSchema,
  async (input): Promise<GrantAccessResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: personData, error: personError } = await supabase
      .from('users')
      .select('id, full_name, role, status')
      .eq('email', input.email)
      .eq('role', 'accountant')
      .is('deleted_at', null)
      .maybeSingle();

    if (personError) {
      logger.error('The accountant could not be looked up', personError, { companyId: company.id });

      throw new AppError('database_failure', 'Access could not be granted. Please try again.');
    }

    const person = asRow(personData);

    if (person === null) {
      throw new AppError(
        'not_found',
        'No accountant account uses that email address. Invite them from the team page first.'
      );
    }

    if (readString(person, 'status') !== 'active') {
      throw new AppError('conflict', 'That accountant account is not active.');
    }

    const accountantUserId = readString(person, 'id') ?? '';

    const { data: existingData, error: existingError } = await supabase
      .from('accountant_company_access')
      .select('id, status')
      .eq('company_id', company.id)
      .eq('accountant_user_id', accountantUserId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      logger.error('The existing grant could not be read', existingError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'Access could not be granted. Please try again.');
    }

    const existing = asRow(existingData);
    const scopes = [...input.scopes];
    let grantId = existing === null ? '' : (readString(existing, 'id') ?? '');

    if (existing === null) {
      const { data: inserted, error: insertError } = await supabase
        .from('accountant_company_access')
        .insert({
          company_id: company.id,
          accountant_user_id: accountantUserId,
          granted_by: user.id,
          scopes,
          expires_at: input.expiresAt,
        })
        .select('id')
        .maybeSingle();

      if (insertError) {
        logger.error('The accountant grant could not be written', insertError, {
          companyId: company.id,
        });

        throw new AppError('database_failure', 'Access could not be granted. Please try again.');
      }

      const insertedRow = asRow(inserted);
      grantId = insertedRow === null ? '' : (readString(insertedRow, 'id') ?? '');
    } else {
      const { error: updateError } = await supabase
        .from('accountant_company_access')
        .update({
          status: 'active',
          scopes,
          expires_at: input.expiresAt,
          revoked_at: null,
          revoked_by: null,
          granted_by: user.id,
        })
        .eq('id', grantId);

      if (updateError) {
        logger.error('The accountant grant could not be restored', updateError, {
          companyId: company.id,
        });

        throw new AppError('database_failure', 'Access could not be granted. Please try again.');
      }
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'accountant_company_access',
      entityId: grantId,
      companyId: company.id,
      description: `Access to the books was granted to ${input.email}.`,
      metadata: { scopes },
    });

    revalidatePath(`${ROUTES.dashboard}/settings/accountants`);

    return { grantId, accountantName: readString(person, 'full_name') ?? input.email };
  },
  { name: 'grantAccountantAccess' }
);
