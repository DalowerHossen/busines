// src/features/messaging/queries/list-route-activity.ts
// Reading the conversations that are walking down a fallback chain, and the
// ones that have already finished one way or another.

import type { RouteActivityRecord } from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { asRows, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RouteActivityResult {
  runs: readonly RouteActivityRecord[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Reads recent fallback chains for one business.
 *
 * @param companyId Business whose activity is being read.
 * @param limit How many conversations to read.
 * @returns The conversations, and whether the read failed.
 */
export async function loadRouteActivity(
  companyId: string,
  limit = 50
): Promise<RouteActivityResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('message_route_activity', {
    p_company_id: companyId,
    p_limit: limit,
  });

  if (error) {
    logger.error('The messaging activity could not be read', error, { companyId });

    return { runs: [], isDegraded: true };
  }

  const runs = asRows(data).map((row) => ({
    runId: readString(row, 'run_id') ?? '',
    routeName: readString(row, 'route_name') ?? '',
    clientName: readString(row, 'client_name'),
    relatedEntityType: readString(row, 'related_entity_type'),
    status: readString(row, 'status') ?? 'running',
    attemptedChannels: readStringArray(row, 'attempted_channels'),
    deliveredChannel: readString(row, 'delivered_channel'),
    nextActionAt: readString(row, 'next_action_at'),
    totalCost: readString(row, 'total_cost') ?? '0',
    startedAt: readString(row, 'started_at') ?? '',
    completedAt: readString(row, 'completed_at'),
  }));

  return { runs, isDegraded: false };
}
