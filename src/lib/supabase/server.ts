// src/lib/supabase/server.ts
// Request-scoped Server Component/Route Handler client. Auth cookies are
// read and refreshed through @supabase/ssr; browser code cannot import this
// module because it is protected by server-only.
import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env/env.server';

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Server Components cannot mutate cookies. Middleware and Route
            // Handlers perform the actual refresh on the next response.
          }
        },
      },
    }
  );
}

export async function getAuthenticatedServerUser() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error) {
    return { user: null, error };
  }
  return { user, error: null };
}
