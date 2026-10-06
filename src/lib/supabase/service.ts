// src/lib/supabase/service.ts
// The service role client. It bypasses row level security, so it is only for
// background jobs, webhooks and platform maintenance, never for a request
// made on behalf of a signed in user.

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { clientEnv } from '@/lib/env/env.client';
import { serverEnv } from '@/lib/env/env.server';
import type { Database } from '@/types/database';

export type ServiceSupabaseClient = SupabaseClient<Database, 'public'>;

let cachedClient: ServiceSupabaseClient | null = null;

/**
 * Returns the service role client, creating it on first use.
 *
 * Every caller must filter by company itself: row level security is not
 * applied to this connection.
 *
 * @returns A client with full database access.
 */
export function getServiceSupabaseClient(): ServiceSupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient<Database, 'public'>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'X-Client-Info': 'kd-solution-it-service',
          },
        },
      }
    );
  }

  return cachedClient;
}
