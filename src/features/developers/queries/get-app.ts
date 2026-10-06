// src/features/developers/queries/get-app.ts
// One application in full: how it describes itself, where it may send an
// authorisation, and which accounts are using it.

import type {
  DeveloperAppDetail,
  DeveloperAppDistribution,
  DeveloperAppInstallUsage,
  DeveloperAppStatus,
  DeveloperAppType,
  DeveloperRedirectUri,
} from '@/features/developers/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json, JsonObject } from '@/types/json';
import { isJsonObject } from '@/types/json';

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

/**
 * Reads a string out of a payload built by the database.
 *
 * @param payload Object returned by the function.
 * @param key Field being read.
 * @returns The text, or null.
 */
function text(payload: JsonObject, key: string): string | null {
  const value = payload[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reads a list of strings out of a payload built by the database.
 *
 * @param payload Object returned by the function.
 * @param key Field being read.
 * @returns The values found.
 */
function textList(payload: JsonObject, key: string): string[] {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((member): member is string => typeof member === 'string');
}

/**
 * Reads a whole number out of a payload built by the database.
 *
 * @param payload Object returned by the function.
 * @param key Field being read.
 * @returns The number, or zero.
 */
function count(payload: JsonObject, key: string): number {
  const value = payload[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Narrows a value to one of a known set.
 *
 * @param value Value read from the payload.
 * @param allowed Values that are acceptable.
 * @param fallback Value used when the payload disagrees.
 * @returns One of the allowed values.
 */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/**
 * Maps the list of return addresses.
 *
 * @param entries Raw list from the payload.
 * @returns The addresses the portal renders.
 */
function toRedirectUris(entries: Json | undefined): DeveloperRedirectUri[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(isJsonObject).map((entry) => ({
    redirectUri: text(entry, 'redirect_uri') ?? '',
    environment: text(entry, 'environment') ?? 'production',
    isActive: entry['is_active'] === true,
  }));
}

/**
 * Maps the list of accounts using the application.
 *
 * @param entries Raw list from the payload.
 * @returns The usage rows the portal renders.
 */
function toInstalls(entries: Json | undefined): DeveloperAppInstallUsage[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(isJsonObject).map((entry) => ({
    installId: text(entry, 'install_id') ?? '',
    status: text(entry, 'status') ?? 'active',
    installedAt: text(entry, 'installed_at') ?? '',
    lastUsedAt: text(entry, 'last_used_at'),
    requestCount: count(entry, 'request_count'),
    errorCount: count(entry, 'error_count'),
  }));
}

/**
 * Reads one application the signed in account may administer.
 *
 * @param appId Application being opened.
 * @returns The application, or null when it cannot be read.
 */
export async function loadDeveloperApp(appId: string): Promise<DeveloperAppDetail | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('developer_app_detail', { p_app_id: appId });

  if (error || !isJsonObject(data)) {
    logger.error('The application could not be read', error, { appId });

    return null;
  }

  return {
    appId: text(data, 'app_id') ?? appId,
    appSlug: text(data, 'app_slug') ?? '',
    appName: text(data, 'app_name') ?? '',
    tagline: text(data, 'tagline'),
    description: text(data, 'description'),
    homepageUrl: text(data, 'homepage_url'),
    privacyPolicyUrl: text(data, 'privacy_policy_url'),
    supportEmail: text(data, 'support_email'),
    appType: oneOf(text(data, 'app_type'), TYPES, 'oauth'),
    distribution: oneOf(text(data, 'distribution'), DISTRIBUTIONS, 'private'),
    status: oneOf(text(data, 'status'), STATUSES, 'draft'),
    clientId: text(data, 'client_id') ?? '',
    clientSecretHint: text(data, 'client_secret_hint'),
    secretRotatedAt: text(data, 'secret_rotated_at'),
    requestedScopes: textList(data, 'requested_scopes'),
    allowedScopes: textList(data, 'allowed_scopes'),
    webhookUrl: text(data, 'webhook_url'),
    rateLimitPerMinute: count(data, 'rate_limit_per_minute'),
    rejectionReason: text(data, 'rejection_reason'),
    installCount: count(data, 'install_count'),
    redirectUris: toRedirectUris(data['redirect_uris']),
    installs: toInstalls(data['installs']),
  };
}
