// src/features/developers/queries/list-directory.ts
// The public directory of applications anybody may connect.

import type { DeveloperAppType, DirectoryApp } from '@/features/developers/types';
import { logger } from '@/lib/logger';
import { asRows, readEnum, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const TYPES: readonly DeveloperAppType[] = ['oauth', 'api_key', 'extension', 'webhook_consumer'];

export interface DirectoryList {
  apps: readonly DirectoryApp[];
  /** True when the directory could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one listed application.
 *
 * @param row Row returned by public.developer_app_directory.
 * @returns The entry the directory renders.
 */
function toDirectoryApp(row: DatabaseRow): DirectoryApp {
  return {
    appSlug: readString(row, 'app_slug') ?? '',
    appName: readString(row, 'app_name') ?? '',
    tagline: readString(row, 'tagline'),
    description: readString(row, 'description'),
    appType: readEnum(row, 'app_type', TYPES, 'oauth'),
    homepageUrl: readString(row, 'homepage_url'),
    supportEmail: readString(row, 'support_email'),
    allowedScopes: readStringArray(row, 'allowed_scopes'),
    installCount: readNumber(row, 'install_count') ?? 0,
  };
}

/**
 * Reads the applications listed in the public directory.
 *
 * @returns The listed applications and whether the read succeeded.
 */
export async function loadAppDirectory(): Promise<DirectoryList> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('developer_app_directory');

  if (error) {
    logger.error('The application directory could not be read', error);

    return { apps: [], isDegraded: true };
  }

  return { apps: asRows(data).map(toDirectoryApp), isDegraded: false };
}
