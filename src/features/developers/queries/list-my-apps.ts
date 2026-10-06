// src/features/developers/queries/list-my-apps.ts
// The applications the signed in account has built, with how far through
// review each of them is and how many accounts are using it.

import type {
  DeveloperAppDistribution,
  DeveloperAppStatus,
  DeveloperAppSummary,
  DeveloperAppType,
} from '@/features/developers/types';
import { logger } from '@/lib/logger';
import { asRows, readEnum, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const STATUSES: readonly DeveloperAppStatus[] = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'suspended',
  'retired',
];

const TYPES: readonly DeveloperAppType[] = ['oauth', 'api_key', 'extension', 'webhook_consumer'];

const DISTRIBUTIONS: readonly DeveloperAppDistribution[] = ['private', 'unlisted', 'public'];

export interface DeveloperAppList {
  apps: readonly DeveloperAppSummary[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one application.
 *
 * @param row Row returned by public.my_developer_apps.
 * @returns The summary the portal renders.
 */
function toSummary(row: DatabaseRow): DeveloperAppSummary {
  return {
    appId: readString(row, 'app_id') ?? '',
    appSlug: readString(row, 'app_slug') ?? '',
    appName: readString(row, 'app_name') ?? '',
    tagline: readString(row, 'tagline'),
    appType: readEnum(row, 'app_type', TYPES, 'oauth'),
    distribution: readEnum(row, 'distribution', DISTRIBUTIONS, 'private'),
    status: readEnum(row, 'status', STATUSES, 'draft'),
    clientId: readString(row, 'client_id') ?? '',
    clientSecretHint: readString(row, 'client_secret_hint'),
    requestedScopes: readStringArray(row, 'requested_scopes'),
    allowedScopes: readStringArray(row, 'allowed_scopes'),
    installCount: readNumber(row, 'install_count') ?? 0,
    activeInstalls: readNumber(row, 'active_installs') ?? 0,
    rejectionReason: readString(row, 'rejection_reason'),
    submittedAt: readString(row, 'submitted_at'),
    approvedAt: readString(row, 'approved_at'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Lists the applications the signed in account may administer.
 *
 * @returns The applications and whether the read succeeded.
 */
export async function loadMyDeveloperApps(): Promise<DeveloperAppList> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('my_developer_apps');

  if (error) {
    logger.error('The developer applications could not be read', error);

    return { apps: [], isDegraded: true };
  }

  return { apps: asRows(data).map(toSummary), isDegraded: false };
}
