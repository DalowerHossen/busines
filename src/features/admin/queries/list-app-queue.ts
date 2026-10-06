// src/features/admin/queries/list-app-queue.ts
// Every application the platform team may have to decide about, with what
// is waiting for review at the top.

import type {
  DeveloperAppDistribution,
  DeveloperAppQueueEntry,
  DeveloperAppStatus,
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

export interface AppQueue {
  entries: readonly DeveloperAppQueueEntry[];
  /** How many are waiting for a decision. */
  waitingCount: number;
  /** True when the queue could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one application in the queue.
 *
 * @param row Row returned by public.developer_app_queue.
 * @returns The entry the console renders.
 */
function toEntry(row: DatabaseRow): DeveloperAppQueueEntry {
  return {
    appId: readString(row, 'app_id') ?? '',
    appSlug: readString(row, 'app_slug') ?? '',
    appName: readString(row, 'app_name') ?? '',
    tagline: readString(row, 'tagline'),
    appType: readEnum(row, 'app_type', TYPES, 'oauth'),
    distribution: readEnum(row, 'distribution', DISTRIBUTIONS, 'private'),
    status: readEnum(row, 'status', STATUSES, 'draft'),
    requestedScopes: readStringArray(row, 'requested_scopes'),
    ownerCompanyId: readString(row, 'owner_company_id'),
    ownerName: readString(row, 'owner_name') ?? 'Platform team',
    supportEmail: readString(row, 'support_email'),
    homepageUrl: readString(row, 'homepage_url'),
    submittedAt: readString(row, 'submitted_at'),
    installCount: readNumber(row, 'install_count') ?? 0,
  };
}

/**
 * Reads the application review queue.
 *
 * @returns The queue and whether the read succeeded.
 */
export async function loadAppQueue(): Promise<AppQueue> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('developer_app_queue');

  if (error) {
    logger.error('The application queue could not be read', error);

    return { entries: [], waitingCount: 0, isDegraded: true };
  }

  const entries = asRows(data).map(toEntry);

  return {
    entries,
    waitingCount: entries.filter((entry) => entry.status === 'in_review').length,
    isDegraded: false,
  };
}
