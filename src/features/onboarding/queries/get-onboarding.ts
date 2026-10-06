// src/features/onboarding/queries/get-onboarding.ts
// Reading how far a new seller has got towards being paid.

import type { OnboardingState, OnboardingTask } from '@/features/onboarding/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

const EMPTY: OnboardingState = {
  status: 'onboarding',
  kycStatus: 'not_started',
  requiredCount: 0,
  requiredDone: 0,
  isReadyToTrade: false,
  hasFirstPayment: false,
  tasks: [],
  isDegraded: false,
};

/**
 * Reads the setup state of one business.
 *
 * @param companyId Business being read.
 * @returns What is done, what is left and whether the read failed.
 */
export async function loadOnboardingState(companyId: string): Promise<OnboardingState> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_onboarding_state', {
    p_company_id: companyId,
  });

  if (error || !isJsonObject(data)) {
    logger.error('The setup state could not be read', error, { companyId });

    return { ...EMPTY, isDegraded: true };
  }

  const dismissed = Array.isArray(data['dismissed'])
    ? data['dismissed'].filter((entry): entry is string => typeof entry === 'string')
    : [];

  const rawTasks = Array.isArray(data['tasks']) ? data['tasks'] : [];

  const tasks: OnboardingTask[] = rawTasks.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const key = typeof entry['key'] === 'string' ? entry['key'] : '';

    return [
      {
        key,
        title: typeof entry['title'] === 'string' ? entry['title'] : '',
        description: typeof entry['description'] === 'string' ? entry['description'] : '',
        href: typeof entry['href'] === 'string' ? entry['href'] : '/dashboard',
        isRequired: entry['is_required'] === true,
        isDone: entry['is_done'] === true,
        isDismissed: dismissed.includes(key),
      },
    ];
  });

  /**
   * Reads a counter out of the state.
   *
   * @param field Field being read.
   * @returns The count, or zero.
   */
  function count(field: string): number {
    const value = isJsonObject(data) ? data[field] : null;

    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
  }

  return {
    status: typeof data['status'] === 'string' ? data['status'] : 'onboarding',
    kycStatus: typeof data['kyc_status'] === 'string' ? data['kyc_status'] : 'not_started',
    requiredCount: count('required_count'),
    requiredDone: count('required_done'),
    isReadyToTrade: data['is_ready_to_trade'] === true,
    hasFirstPayment: data['has_first_payment'] === true,
    tasks,
    isDegraded: false,
  };
}
