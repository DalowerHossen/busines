// The service-role client is created only inside trusted Edge Runtime code.
// Browser code must use the normal authenticated Supabase client instead.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('Scheduled function configuration is incomplete');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function asDate(value: string | null): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('The as_of value must be an ISO calendar date');
  }
  return value;
}
