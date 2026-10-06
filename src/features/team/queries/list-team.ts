// src/features/team/queries/list-team.ts
// Reading the people of one business: the accounts that already exist and the
// invitations that have not been accepted yet.

import { sanitisePermissionMap } from '@/config/permissions';
import type { TeamInvitation, TeamMember, TeamOverview } from '@/features/team/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { INVITATION_STATUSES, USER_ROLES, USER_STATUSES } from '@/types/enums';

const MEMBER_COLUMNS =
  'id, full_name, email, role, status, job_title, permissions, two_factor_enabled, last_login_at, created_at, suspension_reason';

const INVITATION_COLUMNS =
  'id, email, full_name, role, status, permissions, message, created_at, expires_at, reminder_count';

/**
 * Maps one account row into a team member.
 *
 * @param row Row read from public.users.
 * @returns The member the table renders.
 */
function toMember(row: DatabaseRow): TeamMember {
  return {
    id: readString(row, 'id') ?? '',
    fullName: readString(row, 'full_name') ?? '',
    email: readString(row, 'email') ?? '',
    role: readEnum(row, 'role', USER_ROLES, 'staff'),
    status: readEnum(row, 'status', USER_STATUSES, 'pending_verification'),
    jobTitle: readString(row, 'job_title'),
    permissions: sanitisePermissionMap(row['permissions']),
    twoFactorEnabled: readBoolean(row, 'two_factor_enabled'),
    lastLoginAt: readString(row, 'last_login_at'),
    createdAt: readString(row, 'created_at') ?? '',
    suspensionReason: readString(row, 'suspension_reason'),
  };
}

/**
 * Maps one invitation row.
 *
 * @param row Row read from public.team_invitations.
 * @param now Moment the page is being rendered.
 * @returns The invitation the table renders.
 */
function toInvitation(row: DatabaseRow, now: number): TeamInvitation {
  const expiresAt = readString(row, 'expires_at') ?? '';
  const status = readEnum(row, 'status', INVITATION_STATUSES, 'pending');

  return {
    id: readString(row, 'id') ?? '',
    email: readString(row, 'email') ?? '',
    fullName: readString(row, 'full_name'),
    role: readEnum(row, 'role', USER_ROLES, 'staff'),
    status,
    permissions: sanitisePermissionMap(row['permissions']),
    message: readString(row, 'message'),
    invitedAt: readString(row, 'created_at') ?? '',
    expiresAt,
    isExpired: status === 'pending' && expiresAt !== '' && Date.parse(expiresAt) < now,
    reminderCount: readNumber(row, 'reminder_count') ?? 0,
  };
}

/**
 * Reads everybody attached to one business.
 *
 * @param companyId Company whose team is read.
 * @returns The members, the outstanding invitations, and whether the read
 *   succeeded.
 */
export async function loadTeamOverview(companyId: string): Promise<TeamOverview> {
  const supabase = createServerSupabaseClient();

  const [memberResult, invitationResult] = await Promise.all([
    supabase
      .from('users')
      .select(MEMBER_COLUMNS)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true }),
    supabase
      .from('team_invitations')
      .select(INVITATION_COLUMNS)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .in('status', ['pending', 'expired'])
      .order('created_at', { ascending: false }),
  ]);

  if (memberResult.error || invitationResult.error) {
    logger.error(
      'Could not read the team of this business',
      memberResult.error ?? invitationResult.error,
      { companyId }
    );

    return { members: [], invitations: [], isDegraded: true };
  }

  const now = Date.now();

  return {
    members: asRows(memberResult.data).map(toMember),
    invitations: asRows(invitationResult.data).map((row) => toInvitation(row, now)),
    isDegraded: false,
  };
}
