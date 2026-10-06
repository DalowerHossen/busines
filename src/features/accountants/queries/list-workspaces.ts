// src/features/accountants/queries/list-workspaces.ts
// The list a bookkeeper lands on: every business that invited them, with
// enough on each line to decide which one needs attention first.

import type { AccountantWorkspace } from '@/features/accountants/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

export interface AccountantWorkspaceList {
  /** Businesses this accountant may work on. */
  workspaces: readonly AccountantWorkspace[];
  /** True when the figures could not be read and the page is showing less. */
  isDegraded: boolean;
}

/**
 * Reads the scopes a grant carries, falling back to the standard three.
 *
 * @param row Row returned by the database.
 * @returns The scope names.
 */
function readScopes(row: DatabaseRow): string[] {
  const value = row['scopes'];

  if (!Array.isArray(value)) {
    return ['accounting', 'reports', 'expenses'];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Maps one business the accountant works on.
 *
 * @param row Row returned by public.accountant_workspaces.
 * @returns The workspace the portal renders.
 */
function toWorkspace(row: DatabaseRow): AccountantWorkspace {
  return {
    companyId: readString(row, 'company_id') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    baseCurrency: readString(row, 'base_currency') ?? 'USD',
    grantedAt: readString(row, 'granted_at') ?? '',
    expiresAt: readString(row, 'expires_at'),
    lastAccessedAt: readString(row, 'last_accessed_at'),
    scopes: readScopes(row),
    outstandingAmount: readAmount(row, 'outstanding_amount'),
    overdueAmount: readAmount(row, 'overdue_amount'),
    collectedThisMonth: readAmount(row, 'collected_this_month'),
    expensesThisMonth: readAmount(row, 'expenses_this_month'),
    draftEntries: readNumber(row, 'draft_entries') ?? 0,
    unreconciledTransactions: readNumber(row, 'unreconciled_transactions') ?? 0,
  };
}

/**
 * Lists the businesses the signed in accountant may work on.
 *
 * @returns The workspaces and whether anything had to be left out.
 */
export async function loadAccountantWorkspaces(): Promise<AccountantWorkspaceList> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('accountant_workspaces');

  if (error) {
    logger.error('The bookkeeping list could not be read', error);

    return { workspaces: [], isDegraded: true };
  }

  return { workspaces: asRows(data).map(toWorkspace), isDegraded: false };
}
