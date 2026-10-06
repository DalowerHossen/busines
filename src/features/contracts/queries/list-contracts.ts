// src/features/contracts/queries/list-contracts.ts
// Reading the agreements of one business and the shape of the pile.

import type { ContractOverview, ContractSummaryRecord } from '@/features/contracts/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface ContractListResult {
  contracts: readonly ContractSummaryRecord[];
  overview: ContractOverview;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_OVERVIEW: ContractOverview = {
  draftCount: 0,
  awaitingCount: 0,
  completedCount: 0,
  declinedCount: 0,
  signedValue: '0',
  awaitingValue: '0',
  closingSoon: 0,
};

/**
 * Reads a number out of the overview whatever shape it arrived in.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function count(source: Record<string, unknown>, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads an amount out of the overview.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The amount as text.
 */
function amount(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '0';
}

/**
 * Reads the agreements of one business.
 *
 * @param companyId Business whose agreements are being read.
 * @param status Optional state to narrow the list to.
 * @returns The agreements, the counts, and whether the read failed.
 */
export async function loadContracts(
  companyId: string,
  status: string | null = null
): Promise<ContractListResult> {
  const supabase = createServerSupabaseClient();

  const [list, overview] = await Promise.all([
    supabase.rpc('company_contracts', {
      p_company_id: companyId,
      p_status: status,
      p_limit: 100,
    }),
    supabase.rpc('contract_overview', { p_company_id: companyId }),
  ]);

  if (list.error || overview.error) {
    logger.error('The agreements could not be read', list.error ?? overview.error, { companyId });

    return { contracts: [], overview: EMPTY_OVERVIEW, isDegraded: true };
  }

  const contracts = asRows(list.data).map((row) => ({
    contractId: readString(row, 'contract_id') ?? '',
    contractNumber: readString(row, 'contract_number') ?? '',
    title: readString(row, 'title') ?? '',
    status: readString(row, 'status') ?? 'draft',
    clientId: readString(row, 'client_id'),
    clientName: readString(row, 'client_name'),
    currency: readString(row, 'currency'),
    contractValue: readString(row, 'contract_value'),
    effectiveDate: readString(row, 'effective_date'),
    expiryDate: readString(row, 'expiry_date'),
    validUntil: readString(row, 'valid_until'),
    signerCount: readNumber(row, 'signer_count') ?? 0,
    signedCount: readNumber(row, 'signed_count') ?? 0,
    sentAt: readString(row, 'sent_at'),
    completedAt: readString(row, 'completed_at'),
    sealedAt: readString(row, 'sealed_at'),
    updatedAt: readString(row, 'updated_at') ?? '',
  }));

  const source = isJsonObject(overview.data) ? overview.data : {};

  return {
    contracts,
    overview: {
      draftCount: count(source, 'draft_count'),
      awaitingCount: count(source, 'awaiting_count'),
      completedCount: count(source, 'completed_count'),
      declinedCount: count(source, 'declined_count'),
      signedValue: amount(source, 'signed_value'),
      awaitingValue: amount(source, 'awaiting_value'),
      closingSoon: count(source, 'closing_soon'),
    },
    isDegraded: false,
  };
}

/**
 * Reads the wording a business can start an agreement from.
 *
 * @param companyId Business asking.
 * @returns The wording on offer, newest tenant wording last.
 */
export async function loadContractWording(companyId: string) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('contract_wording_choices', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The agreement wording could not be read', error, { companyId });

    return [];
  }

  return asRows(data).map((row) => ({
    templateId: readString(row, 'template_id') ?? '',
    templateKey: readString(row, 'template_key') ?? '',
    name: readString(row, 'name') ?? '',
    description: readString(row, 'description'),
    category: readString(row, 'category') ?? 'general',
    bodyHtml: readString(row, 'body_html') ?? '',
    isPlatform: readBoolean(row, 'is_platform'),
  }));
}
