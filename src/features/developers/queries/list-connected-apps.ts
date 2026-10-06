// src/features/developers/queries/list-connected-apps.ts
// The applications one business has let in, so an owner can see what is
// reading their data and cut any of it off.

import type { ConnectedApp } from '@/features/developers/types';
import { logger } from '@/lib/logger';
import { asRows, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

export interface ConnectedAppList {
  apps: readonly ConnectedApp[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one connected application.
 *
 * @param row Row returned by public.connected_apps.
 * @returns The row the settings page renders.
 */
function toConnectedApp(row: DatabaseRow): ConnectedApp {
  return {
    installId: readString(row, 'install_id') ?? '',
    appName: readString(row, 'app_name') ?? '',
    appSlug: readString(row, 'app_slug') ?? '',
    grantedScopes: readStringArray(row, 'granted_scopes'),
    installedAt: readString(row, 'installed_at') ?? '',
    lastUsedAt: readString(row, 'last_used_at'),
    requestCount: readNumber(row, 'request_count') ?? 0,
    status: readString(row, 'status') ?? 'active',
  };
}

/**
 * Lists the applications connected to one business.
 *
 * @param companyId Company whose grants are read.
 * @returns The grants and whether the read succeeded.
 */
export async function loadConnectedApps(companyId: string): Promise<ConnectedAppList> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('connected_apps', { p_company_id: companyId });

  if (error) {
    logger.error('The connected applications could not be read', error, { companyId });

    return { apps: [], isDegraded: true };
  }

  return { apps: asRows(data).map(toConnectedApp), isDegraded: false };
}
