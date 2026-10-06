// src/app/api/integrations/drive/start/route.ts
// Sending an owner to their drive to ask for permission.
//
// The state carried through the consent is signed, so the answer that comes
// back can be tied to the business that started it and to nothing else.

import { NextResponse } from 'next/server';

import { ROUTES } from '@/config/app';
import { absoluteUrl } from '@/lib/env/env.client';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { signDriveState } from '@/lib/storage/drive/state';
import { driveClientIdentity, DRIVE_SCOPE } from '@/lib/storage/drive/client';

export const dynamic = 'force-dynamic';

/** Where the drive asks the person to agree. */
const CONSENT_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * Starts the drive connection.
 *
 * @returns A redirect to the consent screen, or an explanation.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse('Sign in first.', HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return errorResponse(
      'Only the account owner may connect a drive.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (company === null) {
    return errorResponse(
      'This account is not attached to a business yet.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const decision = await consumeRateLimit({
    kind: 'drive_connect',
    key: user.id,
    limit: 10,
    windowSeconds: 600,
  });

  if (!decision.isAllowed) {
    return errorResponse(
      'That has been tried several times already. Wait a few minutes.',
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  const identity = driveClientIdentity();

  if (identity === null) {
    return errorResponse(
      'Drive storage has not been set up on this installation yet.',
      HTTP_STATUS.serverError,
      'integration_failure'
    );
  }

  const redirectUri = absoluteUrl('/api/integrations/drive/callback');
  const parameters = new URLSearchParams({
    client_id: identity.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signDriveState(company.id, user.id),
  });

  const response = NextResponse.redirect(`${CONSENT_ENDPOINT}?${parameters.toString()}`, {
    status: HTTP_STATUS.temporaryRedirect,
  });

  response.headers.set('cache-control', 'no-store');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('x-return-path', `${ROUTES.settings}/storage`);

  return response;
}
