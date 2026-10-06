// src/features/contracts/queries/list-client-choices.ts
// The clients an agreement can be attached to, as a plain list for a picker.

import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ClientChoice {
  clientId: string;
  displayName: string;
  email: string | null;
}

/**
 * Reads the clients of one business for a picker.
 *
 * @param companyId Business whose clients are being read.
 * @returns The clients in alphabetical order.
 */
export async function loadClientChoices(companyId: string): Promise<readonly ClientChoice[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('clients')
    .select('id, display_name, email')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
    .limit(500);

  if (error) {
    logger.error('The client list for an agreement could not be read', error, { companyId });

    return [];
  }

  return asRows(data).map((row) => ({
    clientId: readString(row, 'id') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    email: readString(row, 'email'),
  }));
}
