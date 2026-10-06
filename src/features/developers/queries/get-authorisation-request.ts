// src/features/developers/queries/get-authorisation-request.ts
// Reading the application behind an authorisation request, so the consent
// screen can say truthfully who is asking and for what.

import { describeScope, type ApiScope } from '@/features/developers/scopes';
import { logger } from '@/lib/logger';
import { asRow, readString, readStringArray } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface AuthorisationRequest {
  appId: string;
  appName: string;
  appSlug: string;
  tagline: string | null;
  homepageUrl: string | null;
  privacyPolicyUrl: string | null;
  supportEmail: string | null;
  /** Scopes the application is allowed to ask for. */
  allowedScopes: readonly string[];
  /** Scopes it is asking for on this request. */
  requestedScopes: readonly ApiScope[];
  redirectUri: string;
  /** Why the request cannot go ahead, when it cannot. */
  refusalReason: string | null;
}

/**
 * Builds the consent screen for one authorisation request.
 *
 * @param clientId Public identifier the application sent.
 * @param redirectUri Address the authorisation would be returned to.
 * @param scopes Permissions the application is asking for.
 * @returns The request, or null when the application is unknown.
 */
export async function loadAuthorisationRequest(
  clientId: string,
  redirectUri: string,
  scopes: readonly string[]
): Promise<AuthorisationRequest | null> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('developer_apps')
    .select(
      'id, app_name, app_slug, tagline, homepage_url, privacy_policy_url, support_email, allowed_scopes, status'
    )
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .maybeSingle();

  const row = asRow(data);

  if (error || row === null) {
    logger.warn('An unknown application asked for an authorisation', { clientId });

    return null;
  }

  const allowedScopes = readStringArray(row, 'allowed_scopes');
  const appId = readString(row, 'id') ?? '';

  const { data: uriData } = await supabase
    .from('developer_app_redirect_uris')
    .select('redirect_uri')
    .eq('app_id', appId)
    .eq('redirect_uri', redirectUri)
    .eq('is_active', true)
    .maybeSingle();

  const unknownScope = scopes.find((scope) => !allowedScopes.includes(scope)) ?? null;
  let refusalReason: string | null = null;

  if (readString(row, 'status') !== 'approved') {
    refusalReason = 'This application has not been approved by the platform team.';
  } else if (asRow(uriData) === null) {
    refusalReason = 'This application is not allowed to use that return address.';
  } else if (scopes.length === 0) {
    refusalReason = 'This application did not say what it needs access to.';
  } else if (unknownScope !== null) {
    refusalReason = `This application may not ask for ${unknownScope}.`;
  }

  return {
    appId,
    appName: readString(row, 'app_name') ?? '',
    appSlug: readString(row, 'app_slug') ?? '',
    tagline: readString(row, 'tagline'),
    homepageUrl: readString(row, 'homepage_url'),
    privacyPolicyUrl: readString(row, 'privacy_policy_url'),
    supportEmail: readString(row, 'support_email'),
    allowedScopes,
    requestedScopes: scopes.map(describeScope),
    redirectUri,
    refusalReason,
  };
}
