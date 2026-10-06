// src/features/onboarding/queries/list-funnel.ts
// Who signed up recently, and where they stopped.

import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface FunnelRow {
  companyId: string;
  companyName: string | null;
  signedUpAt: string;
  status: string;
  requiredDone: number;
  requiredCount: number;
  stuckOn: string | null;
  hasFirstPayment: boolean;
}

export interface FunnelResult {
  rows: readonly FunnelRow[];
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads the signup funnel for the platform team.
 *
 * @param days How far back to look.
 * @returns The sellers who signed up, and where each one stopped.
 */
export async function loadOnboardingFunnel(days = 30): Promise<FunnelResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('onboarding_funnel', { p_days: days });

  if (error) {
    logger.error('The signup funnel could not be read', error);

    return { rows: [], isDegraded: true };
  }

  return {
    rows: asRows(data).map((row) => ({
      companyId: readString(row, 'company_id') ?? '',
      companyName: readString(row, 'company_name'),
      signedUpAt: readString(row, 'signed_up_at') ?? '',
      status: readString(row, 'status') ?? 'onboarding',
      requiredDone: readNumber(row, 'required_done') ?? 0,
      requiredCount: readNumber(row, 'required_count') ?? 0,
      stuckOn: readString(row, 'stuck_on'),
      hasFirstPayment: readBoolean(row, 'has_first_payment'),
    })),
    isDegraded: false,
  };
}
