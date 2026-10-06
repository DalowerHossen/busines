// src/app/api/integrations/drive/callback/route.ts
// Taking the permission a business just granted over its drive.
//
// The consent code is exchanged for a long lived permission, a folder is
// created to keep the documents of that business together, and the whole
// bundle is encrypted before it reaches the database. From that moment every
// upload for this tenant lands in their drive rather than on our storage.

import { NextResponse, type NextRequest } from 'next/server';

import { ROUTES } from '@/config/app';
import { absoluteUrl } from '@/env/client';
import { recordAuditEntry } from '@/lib/audit/record';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { sha256Hex } from '@/lib/crypto/hashing';
import { HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import {
  createDriveFolder,
  driveAccessToken,
  driveClientIdentity,
  exchangeDriveCode,
} from '@/lib/storage/drive/client';
import { readDriveState } from '@/lib/storage/drive/state';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Name of the folder the documents of a business are kept in. */
const FOLDER_NAME = 'KD SOLUTION IT documents';

/**
 * Sends the person back to the settings screen with the outcome.
 *
 * @param outcome Short word describing what happened.
 * @returns The redirect.
 */
function backToSettings(outcome: string): NextResponse {
  const response = NextResponse.redirect(
    absoluteUrl(`${ROUTES.settings}/storage?drive=${outcome}`),
    { status: HTTP_STATUS.temporaryRedirect }
  );

  response.headers.set('cache-control', 'no-store');
  response.headers.set('referrer-policy', 'no-referrer');

  return response;
}

/**
 * Receives the answer from the drive consent screen.
 *
 * @param request Incoming request.
 * @returns A redirect back to the settings screen.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const parameters = request.nextUrl.searchParams;

  if (parameters.get('error') !== null) {
    return backToSettings('refused');
  }

  const state = readDriveState(parameters.get('state'));
  const code = parameters.get('code');

  if (state === null || code === null) {
    return backToSettings('expired');
  }

  const identity = driveClientIdentity();

  if (identity === null) {
    return backToSettings('unconfigured');
  }

  const redirectUri = absoluteUrl('/api/integrations/drive/callback');
  const refreshToken = await exchangeDriveCode(code, redirectUri, identity);

  if (refreshToken === null) {
    return backToSettings('refused');
  }

  try {
    const accessToken = await driveAccessToken({
      clientId: identity.clientId,
      clientSecret: identity.clientSecret,
      refreshToken,
      folderId: 'root',
    });

    const folderId = await createDriveFolder(accessToken, FOLDER_NAME);
    const bundle = encryptCredentialBundle({
      client_id: identity.clientId,
      client_secret: identity.clientSecret,
      refresh_token: refreshToken,
      folder_id: folderId,
    });

    const service = getServiceSupabaseClient();

    const { error } = await service.rpc('connect_company_drive', {
      p_company_id: state.companyId,
      p_folder_id: folderId,
      p_folder_name: FOLDER_NAME,
      p_credentials_encrypted: bundle,
      p_fingerprint: sha256Hex(`${folderId}:${refreshToken}`),
    });

    if (error) {
      logger.error('A drive connection could not be stored', error, {
        companyId: state.companyId,
      });

      return backToSettings('failed');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'storage_target',
      entityId: state.companyId,
      companyId: state.companyId,
      description: 'Connected a cloud drive for document storage',
      metadata: { folder: FOLDER_NAME },
    });

    return backToSettings('connected');
  } catch (cause) {
    logger.error('A drive could not be prepared', cause, { companyId: state.companyId });

    return backToSettings('failed');
  }
}
