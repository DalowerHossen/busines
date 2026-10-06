// src/lib/supabase/server.ts
// The Supabase client used in server components, server actions and route
// handlers. It reads the session from cookies and respects row level security.

import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { clientEnv } from '@/env/client';
import type { Database } from '@/types/database';

export type ServerSupabaseClient = SupabaseClient<Database, 'public'>;

/**
 * Creates a request scoped Supabase client.
 *
 * Writing cookies is only possible in a server action or a route handler; in a
 * server component the write is ignored, which is what Supabase expects.
 *
 * @returns A client bound to the current request.
 */
export function createServerSupabaseClient(): ServerSupabaseClient {
  const cookieStore = cookies();

  return createServerClient<Database, 'public'>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string): string | undefined {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions): void {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // A server component cannot write cookies; the middleware refreshes
            // the session instead.
          }
        },
        remove(name: string, options: CookieOptions): void {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch {
            // Same as above: the middleware owns cookie removal.
          }
        },
      },
    }
  );
}
