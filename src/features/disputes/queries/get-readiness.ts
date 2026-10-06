// src/features/disputes/queries/get-readiness.ts
// How strong the file behind one invoice is, before anybody disputes it.

import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface DisputeReadiness {
  score: number;
  band: 'strong' | 'workable' | 'weak';
  hasWorkEvidence: boolean;
  hasConsentRecord: boolean;
  hasDeliveryProof: boolean;
  hasViewProof: boolean;
  hasTerms: boolean;
  hasFrozenProfile: boolean;
  missing: readonly string[];
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY: DisputeReadiness = {
  score: 0,
  band: 'weak',
  hasWorkEvidence: false,
  hasConsentRecord: false,
  hasDeliveryProof: false,
  hasViewProof: false,
  hasTerms: false,
  hasFrozenProfile: false,
  missing: [],
  isDegraded: false,
};

/**
 * Reads how defensible one invoice would be in a dispute today.
 *
 * @param invoiceId Invoice being scored.
 * @returns The score, what is in place and what is missing.
 */
export async function loadDisputeReadiness(invoiceId: string): Promise<DisputeReadiness> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('dispute_readiness', { p_invoice_id: invoiceId });

  if (error || !isJsonObject(data)) {
    logger.error('The dispute readiness could not be read', error, { invoiceId });

    return { ...EMPTY, isDegraded: true };
  }

  const band = data['band'];

  return {
    score: typeof data['score'] === 'number' ? data['score'] : 0,
    band: band === 'strong' || band === 'workable' ? band : 'weak',
    hasWorkEvidence: data['has_work_evidence'] === true,
    hasConsentRecord: data['has_consent_record'] === true,
    hasDeliveryProof: data['has_delivery_proof'] === true,
    hasViewProof: data['has_view_proof'] === true,
    hasTerms: data['has_terms'] === true,
    hasFrozenProfile: data['has_frozen_profile'] === true,
    missing: Array.isArray(data['missing'])
      ? data['missing'].filter((entry): entry is string => typeof entry === 'string')
      : [],
    isDegraded: false,
  };
}
