// src/lib/supabase/admin.ts
// Server-only service-role client. It is for trusted repositories, cron
// workers, and provider callbacks after those callers repeat authorization,
// tenant, validation, and idempotency checks. It must never be imported by a
// Client Component or exposed through a generic browser endpoint.
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env/env.server';

let adminClient: SupabaseClient | undefined;

export function createSupabaseAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { 'x-client-info': 'kd-solution-it-server-admin' },
        },
      }
    );
  }
  return adminClient;
}
