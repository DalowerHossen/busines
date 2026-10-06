// src/features/messaging/queries/get-messaging-overview.ts
// One figure each for reach, consent, chains in flight and what the channels
// cost, so the page opens with an answer rather than a table.

import type { MessagingOverview } from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

const EMPTY: MessagingOverview = {
  activeChannels: 0,
  verifiedChannels: 0,
  reachablePeople: 0,
  optedOutPeople: 0,
  runningRoutes: 0,
  deliveredRoutes: 0,
  exhaustedRoutes: 0,
  unhandledReplies: 0,
  spendLast30Days: '0',
};

/**
 * Reads one number out of the summary.
 *
 * @param source The summary returned by the database.
 * @param key Figure being read.
 * @returns The figure, or zero.
 */
function count(source: Record<string, unknown>, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : 0;
}

/**
 * Reads the messaging summary of one business.
 *
 * @param companyId Business being summarised.
 * @returns The figures, which are all zero when the read failed.
 */
export async function loadMessagingOverview(companyId: string): Promise<MessagingOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('messaging_overview', {
    p_company_id: companyId,
  });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('The messaging summary could not be read', error, { companyId });
    }

    return EMPTY;
  }

  const spend = data.spend_last_30_days;

  return {
    activeChannels: count(data, 'active_channels'),
    verifiedChannels: count(data, 'verified_channels'),
    reachablePeople: count(data, 'reachable_people'),
    optedOutPeople: count(data, 'opted_out_people'),
    runningRoutes: count(data, 'running_routes'),
    deliveredRoutes: count(data, 'delivered_routes'),
    exhaustedRoutes: count(data, 'exhausted_routes'),
    unhandledReplies: count(data, 'unhandled_replies'),
    spendLast30Days: typeof spend === 'number' ? String(spend) : String(spend ?? '0'),
  };
}
