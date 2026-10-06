// src/lib/supabase/middleware.ts
// Session refresh for the edge middleware. Supabase rotates its tokens on the
// response, so the cookies written here must travel back to the browser.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { clientEnv } from '@/env/client';
import type { Database } from '@/types/database';

export interface SessionCheck {
  response: NextResponse;
  userId: string | null;
  email: string | null;
}

/**
 * Refreshes the Supabase session for an incoming request.
 *
 * @param request The request the middleware received.
 * @returns The response to continue with and who is signed in.
 */
export async function refreshSession(request: NextRequest): Promise<SessionCheck> {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient<Database, 'public'>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string): string | undefined {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions): void {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions): void {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  return {
    response,
    userId: data.user?.id ?? null,
    email: data.user?.email ?? null,
  };
}
