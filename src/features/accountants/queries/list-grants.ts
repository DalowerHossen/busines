// src/features/accountants/queries/list-grants.ts
// The other side of the same table: the accountants an owner has let into
// the books, when they were let in and when they last looked.

import type { AccountantGrant } from '@/features/accountants/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

export interface AccountantGrantList {
  /** Accountants holding a grant on this business. */
  grants: readonly AccountantGrant[];
  /** True when the list could not be read in full. */
  isDegraded: boolean;
}

/**
 * Reads the scope names carried by a grant.
 *
 * @param row Row read from public.accountant_company_access.
 * @returns The scope names.
 */
function readScopes(row: DatabaseRow): string[] {
  const value = row['scopes'];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Maps one grant, together with the person it was given to.
 *
 * @param row Row read from public.accountant_company_access.
 * @returns The grant the table renders.
 */
function toGrant(row: DatabaseRow): AccountantGrant {
  const person = asRow(row['users']);

  return {
    id: readString(row, 'id') ?? '',
    accountantUserId: readString(row, 'accountant_user_id') ?? '',
    fullName: person === null ? 'Accountant' : (readString(person, 'full_name') ?? 'Accountant'),
    email: person === null ? '' : (readString(person, 'email') ?? ''),
    status: readString(row, 'status') ?? 'active',
    scopes: readScopes(row),
    grantedAt: readString(row, 'granted_at') ?? '',
    expiresAt: readString(row, 'expires_at'),
    lastAccessedAt: readString(row, 'last_accessed_at'),
  };
}

/**
 * Lists the accountants with access to one business.
 *
 * @param companyId Business whose grants are being read.
 * @returns The grants and whether anything had to be left out.
 */
export async function loadAccountantGrants(companyId: string): Promise<AccountantGrantList> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('accountant_company_access')
    .select(
      'id, accountant_user_id, status, scopes, granted_at, expires_at, last_accessed_at, users:accountant_user_id (full_name, email)'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('granted_at', { ascending: false });

  if (error) {
    logger.error('The accountant access list could not be read', error, { companyId });

    return { grants: [], isDegraded: true };
  }

  return { grants: asRows(data).map(toGrant), isDegraded: false };
}
