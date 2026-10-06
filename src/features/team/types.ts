// src/features/team/types.ts
// The shapes the team pages work with: the people who already have an account
// in this business, and the invitations that are still outstanding.

import type { PermissionMap } from '@/config/permissions';
import type { InvitationStatus, UserRole, UserStatus } from '@/types/enums';

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  jobTitle: string | null;
  permissions: PermissionMap;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  suspensionReason: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: InvitationStatus;
  permissions: PermissionMap;
  message: string | null;
  invitedAt: string;
  expiresAt: string;
  isExpired: boolean;
  reminderCount: number;
}

export interface TeamOverview {
  members: readonly TeamMember[];
  invitations: readonly TeamInvitation[];
  /** True when the people could not be read and an empty list is shown. */
  isDegraded: boolean;
}
