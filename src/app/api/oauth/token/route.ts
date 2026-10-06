// src/app/api/oauth/token/route.ts
// Trading an authorisation code for a token pair.
//
// The application proves who it is with its client secret, the code is spent
// here and can never be spent again, and the answer is the small payload an
// OAuth client expects.

import type { NextRequest, NextResponse } from 'next/server';

import { decryptSecret } from '@/lib/crypto/encryption';
import { signaturesMatch } from '@/lib/crypto/hashing';
import { errorResponse, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, asRows, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { contextFromRequest } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Reads the submitted form, whichever encoding the client chose.
 *
 * @param request Incoming request.
 * @returns The fields as plain text.
 */
async function readFields(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload: unknown = await request.json();
    const fields: Record<string, string> = {};

    if (typeof payload === 'object' && payload !== null) {
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string') {
          fields[key] = value;
        }
      }
    }

    return fields;
  }

  const form = await request.formData();
  const fields: Record<string, string> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      fields[key] = value;
    }
  }

  return fields;
}

/**
 * Checks the secret an application sent against the one on record.
 *
 * @param clientId Public identifier of the application.
 * @param clientSecret Secret the application sent.
 * @returns True when the pair matches, including the rotation grace period.
 */
async function secretMatches(clientId: string, clientSecret: string): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('developer_apps')
    .select(
      'client_secret_encrypted, previous_secret_encrypted, previous_secret_expires_at, status'
    )
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .maybeSingle();

  const row = asRow(data);

  if (error || row === null || readString(row, 'status') !== 'approved') {
    return false;
  }

  const current = readString(row, 'client_secret_encrypted');

  if (current !== null) {
    try {
      if (signaturesMatch(decryptSecret(current), clientSecret)) {
        return true;
      }
    } catch (caught) {
      logger.error('An application secret could not be read', caught, { clientId });
    }
  }

  const previous = readString(row, 'previous_secret_encrypted');
  const expiresAt = readString(row, 'previous_secret_expires_at');

  if (previous === null || expiresAt === null || new Date(expiresAt).getTime() <= Date.now()) {
    return false;
  }

  try {
    return signaturesMatch(decryptSecret(previous), clientSecret);
  } catch (caught) {
    logger.error('A rotated application secret could not be read', caught, { clientId });

    return false;
  }
}

/**
 * Issues tokens for an authorisation code.
 *
 * @param request Incoming request.
 * @returns The token pair, or an explanation in the usual shape.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestContext = contextFromRequest(request);

  const decision = await consumeRateLimit({
    kind: 'developer_token',
    key: requestContext.ipAddress ?? 'unknown',
    limit: 30,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return errorResponse(
      'Too many token requests. Try again shortly.',
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  const fields = await readFields(request);
  const grantType = fields['grant_type'] ?? '';
  const code = fields['code'] ?? '';
  const clientId = fields['client_id'] ?? '';
  const clientSecret = fields['client_secret'] ?? '';
  const redirectUri = fields['redirect_uri'] ?? '';

  if (grantType !== 'authorization_code') {
    return errorResponse(
      'Only the authorization_code grant is supported.',
      HTTP_STATUS.badRequest,
      'validation_failed'
    );
  }

  if (code.length === 0 || clientId.length === 0 || redirectUri.length === 0) {
    return errorResponse(
      'Send the code, the client_id and the redirect_uri.',
      HTTP_STATUS.badRequest,
      'validation_failed'
    );
  }

  if (!(await secretMatches(clientId, clientSecret))) {
    return errorResponse(
      'That application could not be identified.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('exchange_authorization_code', {
    p_code: code,
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
  });

  if (error) {
    logger.warn('An authorisation code could not be exchanged', { clientId });

    return errorResponse(
      'That authorisation code cannot be used.',
      HTTP_STATUS.badRequest,
      'validation_failed'
    );
  }

  const row = asRows(data)[0];

  if (row === undefined) {
    return errorResponse(
      'That authorisation code cannot be used.',
      HTTP_STATUS.badRequest,
      'validation_failed'
    );
  }

  const expiresAt = readString(row, 'expires_at');
  const expiresIn =
    expiresAt === null
      ? 3600
      : Math.max(60, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));

  return jsonResponse({
    access_token: readString(row, 'access_token') ?? '',
    refresh_token: readString(row, 'refresh_token') ?? '',
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: Array.isArray(row['scopes'])
      ? row['scopes'].filter((scope): scope is string => typeof scope === 'string').join(' ')
      : '',
  });
}
