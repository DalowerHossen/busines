// src/app/api/files/[fileId]/route.ts
// Opening a stored file.
//
// Nothing links to the store directly. Every read comes through here so that
// the request can be checked against the tenant that owns the file, written
// to the read trail, and only then turned into a short lived address.

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { contextFromRequest } from '@/lib/security/request-context';
import { storageAdapterFor, storageTargetFrom } from '@/lib/storage/resolve-target';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

export const dynamic = 'force-dynamic';

export interface FileRouteContext {
  /** The file taken from the address. */
  params: { fileId: string };
}

/**
 * Hands back a short lived address for one stored file.
 *
 * @param request Incoming request.
 * @param context The file reference taken from the address.
 * @returns A redirect to the file, or an explanation in the usual shape.
 */
export async function GET(request: NextRequest, context: FileRouteContext): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse('Sign in to open this file.', HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  const decision = await consumeRateLimit({
    kind: 'file_download',
    key: user.id,
    limit: 120,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return errorResponse(
      'That is a lot of downloads at once. Wait a moment and carry on.',
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  const service = getServiceSupabaseClient();

  const { data, error } = await service.rpc('file_storage_target', {
    p_file_id: context.params.fileId,
  });

  if (error || !isJsonObject(data)) {
    return errorResponse('That file was not found.', HTTP_STATUS.notFound, 'not_found');
  }

  const fileCompanyId = typeof data['company_id'] === 'string' ? data['company_id'] : null;
  const company = user.companyId ? await loadCompany(user.companyId) : null;
  const isAllowed =
    user.role === 'super_admin' ||
    (fileCompanyId !== null && company !== null && company.id === fileCompanyId);

  const requestContext = contextFromRequest(request);

  if (!isAllowed) {
    await service.rpc('record_file_access', {
      p_file_id: context.params.fileId,
      p_action: 'download',
      p_document_link_id: null,
      p_ip_hash: requestContext.ipHash,
      p_user_agent: requestContext.userAgent,
      p_was_allowed: false,
      p_denial_reason: 'The file belongs to another business',
    });

    return errorResponse(
      'That file belongs to another business.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  if (typeof data['purged_at'] === 'string') {
    return errorResponse(
      'That file has been removed from storage.',
      HTTP_STATUS.notFound,
      'not_found'
    );
  }

  const target = storageTargetFrom(data);
  const adapter = storageAdapterFor(target.provider);
  const storageKey = typeof data['storage_key'] === 'string' ? data['storage_key'] : '';
  const fileName = typeof data['file_name'] === 'string' ? data['file_name'] : 'download';
  const externalId =
    typeof data['external_object_id'] === 'string' ? data['external_object_id'] : null;
  const mimeType =
    typeof data['mime_type'] === 'string' ? data['mime_type'] : 'application/octet-stream';

  try {
    // A drive serves no address of its own, so the bytes come back through
    // here after the request has been checked.
    if (adapter.streamObject !== undefined) {
      const streamed = await adapter.streamObject(target, externalId ?? storageKey);

      if (streamed === null || streamed.body === null) {
        return errorResponse(
          'That file is no longer in storage.',
          HTTP_STATUS.notFound,
          'not_found'
        );
      }

      await service.rpc('record_file_access', {
        p_file_id: context.params.fileId,
        p_action: 'download',
        p_document_link_id: null,
        p_ip_hash: requestContext.ipHash,
        p_user_agent: requestContext.userAgent,
        p_was_allowed: true,
        p_denial_reason: null,
      });

      return new NextResponse(streamed.body, {
        status: HTTP_STATUS.ok,
        headers: {
          'content-type': mimeType,
          'content-disposition': `inline; filename="${fileName.replace(/"/g, '')}"`,
          'cache-control': 'private, no-store',
          'referrer-policy': 'no-referrer',
        },
      });
    }

    const url = await adapter.createDownloadUrl(target, storageKey, fileName);

    await service.rpc('record_file_access', {
      p_file_id: context.params.fileId,
      p_action: 'download',
      p_document_link_id: null,
      p_ip_hash: requestContext.ipHash,
      p_user_agent: requestContext.userAgent,
      p_was_allowed: true,
      p_denial_reason: null,
    });

    return NextResponse.redirect(new URL(url, request.url), {
      status: HTTP_STATUS.temporaryRedirect,
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  } catch (cause) {
    logger.error('A download address could not be signed', cause, {
      fileId: context.params.fileId,
    });

    await service.rpc('record_storage_target_health', {
      p_target_id: target.targetId,
      p_succeeded: false,
      p_message: 'A download address could not be signed',
    });

    return errorResponse(
      'That file could not be opened right now.',
      HTTP_STATUS.serverError,
      'integration_failure'
    );
  }
}
