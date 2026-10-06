// src/features/files/queries/get-file-trail.ts
// Reading who opened one file, which is what an auditor asks for first.

import type { FileAccessEntry } from '@/features/files/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Reads the read trail of one file.
 *
 * @param fileId File being examined.
 * @returns The entries, newest first.
 */
export async function loadFileTrail(fileId: string): Promise<readonly FileAccessEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('file_access_history', {
    p_file_id: fileId,
    p_limit: 50,
  });

  if (error) {
    logger.error('The read trail of a file could not be read', error, { fileId });

    return [];
  }

  return asRows(data).map((row) => ({
    entryId: readString(row, 'entry_id') ?? '',
    action: readString(row, 'action') ?? 'view',
    actorUserId: readString(row, 'actor_user_id'),
    wasAllowed: readBoolean(row, 'was_allowed', true),
    denialReason: readString(row, 'denial_reason'),
    createdAt: readString(row, 'created_at') ?? '',
  }));
}
