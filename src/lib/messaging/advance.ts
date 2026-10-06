// src/lib/messaging/advance.ts
// Moving a fallback chain on. A step that has waited its time without proof
// of delivery hands over to the next channel; a chain with nothing left to
// try is closed rather than left open for ever.

import 'server-only';

import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/**
 * Advances every chain whose current step has run out of time.
 *
 * @param limit How many chains to move in one run.
 * @returns How many chains were moved.
 */
export async function advanceDueRoutes(limit = 50): Promise<number> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('advance_message_routes', { p_limit: limit });

  if (error) {
    logger.error('The fallback chains could not be advanced', error, { limit });

    return 0;
  }

  return typeof data === 'number' ? data : 0;
}
