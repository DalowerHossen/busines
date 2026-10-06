// src/lib/auth/session.ts
// Reads the signed in account for the current request. The result is memoised
// for the lifetime of the request so a page that asks ten times still issues
// one query.

import 'server-only';

import { cache } from 'react';

import { sanitisePermissionMap } from '@/config/permissions';
import { logger } from '@/lib/logger';
import { readBoolean, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/lib/auth/types';
import type { DatabaseRow } from '@/types/database';
import { USER_ROLES, USER_STATUSES } from '@/types/enums';

const SESSION_COLUMNS =
  'id, email, full_name, role, status, company_id, permissions, avatar_url, time_zone, locale, two_factor_enabled, email_verified_at, suspended_at, last_login_at';

/**
 * Turns a users row into the session shape the application works with.
 *
 * @param row Row read from public.users.
 * @returns The signed in account.
 */
function toSessionUser(row: DatabaseRow): SessionUser {
  return {
    id: readString(row, 'id') ?? '',
    email: readString(row, 'email') ?? '',
    fullName: readString(row, 'full_name') ?? '',
    role: readEnum(row, 'role', USER_ROLES, 'staff'),
    status: readEnum(row, 'status', USER_STATUSES, 'pending_verification'),
    companyId: readString(row, 'company_id'),
    permissions: sanitisePermissionMap(row.permissions),
    avatarUrl: readString(row, 'avatar_url'),
    timeZone: readString(row, 'time_zone') ?? 'UTC',
    locale: readString(row, 'locale') ?? 'en-US',
    twoFactorEnabled: readBoolean(row, 'two_factor_enabled'),
    emailVerifiedAt: readString(row, 'email_verified_at'),
    suspendedAt: readString(row, 'suspended_at'),
    lastLoginAt: readString(row, 'last_login_at'),
  };
}

/**
 * Returns the identifier of the authenticated visitor, if there is one.
 *
 * @returns The authentication identifier, or null when nobody is signed in.
 */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
});

/**
 * Returns the signed in account, or null when the visitor is anonymous.
 *
 * @returns The signed in account.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const authUserId = await getAuthUserId();

  if (!authUserId) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select(SESSION_COLUMNS)
    .eq('id', authUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('The account behind the session could not be read', error, {
      userId: authUserId,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return toSessionUser(data);
});

/**
 * Reports whether anybody is signed in.
 *
 * @returns True when a session exists.
 */
export async function isSignedIn(): Promise<boolean> {
  return (await getAuthUserId()) !== null;
}
