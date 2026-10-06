// src/features/auth/actions/reset-password.ts
// Setting a new password. The link from the message has already created a
// short lived session, so the change is made against that session and written
// to the audit trail.

'use server';

import { ROUTES } from '@/config/app';
import { passwordResetSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { getSessionUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ResetPasswordResult {
  redirectTo: string;
}

export const resetPassword = createAction(
  passwordResetSchema,
  async (input): Promise<ResetPasswordResult> => {
    const supabase = createServerSupabaseClient();
    const { data: session } = await supabase.auth.getUser();

    if (!session.user) {
      throw new AppError(
        'unauthenticated',
        'That reset link has expired. Please ask for a new one.'
      );
    }

    const { error } = await supabase.auth.updateUser({ password: input.password });

    if (error) {
      throw new AppError('validation_failed', 'That password was refused. Please choose another.');
    }

    const user = await getSessionUser();

    await recordAuditEntry({
      action: 'password_change',
      entityType: 'user',
      entityId: session.user.id,
      companyId: user?.companyId ?? null,
      description: 'Password changed through a reset link',
    });

    return { redirectTo: ROUTES.dashboard };
  },
  { name: 'resetPassword' }
);
