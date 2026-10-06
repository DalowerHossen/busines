// src/features/accounting/actions/manage-books.ts
// Opening an account, posting an entry by hand, and undoing one.
//
// A posted entry is never edited. If it was wrong it is reversed, which
// leaves both the mistake and the correction in the record. That is the
// whole difference between bookkeeping and a spreadsheet.

'use server';

import { revalidatePath } from 'next/cache';

import {
  postJournalSchema,
  reverseJournalSchema,
  saveAccountSchema,
} from '@/features/accounting/validation/accounting';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

/** Where the accounting screens live, for cache invalidation. */
const BOOKS_PATH = '/dashboard/reports/books';

export interface AccountResult {
  /** Identifier of the account. */
  accountId: string;
}

export const saveLedgerAccount = createAction(
  saveAccountSchema,
  async (input): Promise<AccountResult> => {
    const { company } = await requirePermission('accounting', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const values = {
      company_id: company.id,
      code: input.code,
      name: input.name,
      account_type: input.accountType,
      description: input.description ?? null,
    };

    if (input.accountId === undefined) {
      const { data, error } = await supabase
        .from('ledger_accounts')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A ledger account could not be created', error, { companyId: company.id });

        throw new AppError(
          'database_failure',
          'That account could not be added. The code may already be in use.'
        );
      }

      const accountId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'ledger_account',
        entityId: accountId,
        companyId: company.id,
        description: `Account ${input.code} ${input.name} opened.`,
      });

      revalidatePath(BOOKS_PATH);

      return { accountId };
    }

    const { error } = await supabase
      .from('ledger_accounts')
      .update({ name: input.name, description: input.description ?? null })
      .eq('id', input.accountId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A ledger account could not be changed', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That account could not be changed. The ones the system uses are protected.'
      );
    }

    revalidatePath(BOOKS_PATH);

    return { accountId: input.accountId };
  },
  { name: 'saveLedgerAccount' }
);

export interface JournalResult {
  /** Identifier of the entry that was posted. */
  entryId: string;
}

export const postJournalEntry = createAction(
  postJournalSchema,
  async (input): Promise<JournalResult> => {
    const { company } = await requirePermission('accounting', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const lines: Json = input.lines
      .filter((line) => Number.parseFloat(line.debit) > 0 || Number.parseFloat(line.credit) > 0)
      .map((line) => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? null,
      }));

    const { data, error } = await supabase.rpc('post_journal_entry', {
      p_company_id: company.id,
      p_lines: lines,
      p_memo: input.memo,
      p_entry_date: input.entryDate,
      p_source_type: 'manual',
      p_source_id: null,
      p_reference: input.reference ?? null,
    });

    if (error) {
      logger.error('A journal entry could not be posted', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That entry could not be posted. Check every line has an account and that the two sides agree.'
      );
    }

    const entryId = typeof data === 'string' ? data : null;

    if (entryId === null) {
      throw new AppError('database_failure', 'It was posted but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'journal_entry',
      entityId: entryId,
      companyId: company.id,
      description: `Journal entry posted by hand: ${input.memo}.`,
    });

    revalidatePath(BOOKS_PATH);

    return { entryId };
  },
  { name: 'postJournalEntry' }
);

export interface ReversalResult {
  /** Identifier of the entry that undoes the original. */
  reversalId: string;
}

export const reverseJournalEntry = createAction(
  reverseJournalSchema,
  async (input): Promise<ReversalResult> => {
    const { company } = await requirePermission('accounting', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('reverse_journal_entry', {
      p_entry_id: input.entryId,
      p_reason: input.reason,
      p_entry_date: null,
    });

    if (error) {
      logger.error('A journal entry could not be reversed', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That entry could not be reversed. It may already have been.'
      );
    }

    const reversalId = typeof data === 'string' ? data : null;

    if (reversalId === null) {
      throw new AppError('database_failure', 'It was reversed but returned no reference.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'journal_entry',
      entityId: input.entryId,
      companyId: company.id,
      description: `Journal entry reversed: ${input.reason}.`,
    });

    revalidatePath(BOOKS_PATH);

    return { reversalId };
  },
  { name: 'reverseJournalEntry' }
);
