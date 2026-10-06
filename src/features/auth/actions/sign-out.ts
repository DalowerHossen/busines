// src/features/auth/actions/sign-out.ts
// Ending a session. The cookies are cleared whatever the provider answers, so
// a shared computer is never left signed in.

'use server';

import { ROUTES } from '@/config/app';
import { createSimpleAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { getSessionUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SignOutResult {
  redirectTo: string;
}

export const signOut = createSimpleAction(
  async (): Promise<SignOutResult> => {
    const user = await getSessionUser();

    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (caught) {
      logger.error('A session could not be ended cleanly', caught, { action: 'signOut' });
    }

    if (user) {
      await recordAuditEntry({
        action: 'logout',
        entityType: 'user',
        entityId: user.id,
        companyId: user.companyId,
        description: 'Signed out',
      });
    }

    return { redirectTo: ROUTES.login };
  },
  { name: 'signOut' }
);
