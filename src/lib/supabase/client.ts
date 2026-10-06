// src/lib/supabase/client.ts
// The Supabase client used inside browser components. It carries the signed
// in session and is always subject to row level security.

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { clientEnv } from '@/lib/env/env.client';
import type { Database } from '@/types/database';

export type BrowserSupabaseClient = SupabaseClient<Database, 'public'>;

let cachedClient: BrowserSupabaseClient | null = null;

/**
 * Returns the browser Supabase client, creating it on first use.
 *
 * @returns A client bound to the signed in session.
 */
export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  if (!cachedClient) {
    cachedClient = createBrowserClient<Database, 'public'>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  return cachedClient;
}
