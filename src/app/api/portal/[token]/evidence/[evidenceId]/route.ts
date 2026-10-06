// src/app/api/portal/[token]/evidence/[evidenceId]/route.ts
// Letting a client open the work that was delivered to them.
//
// The token in the address is the only credential, and it unlocks exactly
// one document. A file is served only when it is attached to that document
// and the seller marked it as something the client may see. Nothing else in
// the file library is reachable from here.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { resolvePortalDocument } from '@/features/portal/queries/resolve-portal-document';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/security/request-context';
import { storageAdapterFor, storageTargetFrom } from '@/lib/storage/resolve-target';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

export const dynamic = 'force-dynamic';

export interface PortalEvidenceContext {
  /** Route parameters of the request. */
  params: { token: string; evidenceId: string };
}

/**
 * Serves one piece of delivered work to the client who was sent the link.
 *
 * @param _request Incoming request.
 * @param context Route parameters of the request.
 * @returns The file, or an explanation in the usual shape.
 */
export async function GET(
  _request: NextRequest,
  context: PortalEvidenceContext
): Promise<NextResponse> {
  const result = await resolvePortalDocument(decodeURIComponent(context.params.token));

  if (!result.isAvailable) {
    return errorResponse(result.message, HTTP_STATUS.notFound, 'not_found');
  }

  const item = result.document.evidence.find(
    (entry) => entry.evidenceId === context.params.evidenceId
  );

  if (item === undefined || item.fileId === null) {
    return errorResponse(
      'That attachment is not part of this document.',
      HTTP_STATUS.notFound,
      'not_found'
    );
  }

  const service = getServiceSupabaseClient();
  const requestContext = getRequestContext();

  const { data, error } = await service.rpc('file_storage_target', { p_file_id: item.fileId });

  if (error || !isJsonObject(data)) {
    logger.error('A delivered file could not be located', error, { fileId: item.fileId });

    return errorResponse(
      'That attachment could not be opened right now.',
      HTTP_STATUS.serverError,
      'integration_failure'
    );
  }

  const target = storageTargetFrom(data);
  const adapter = storageAdapterFor(target.provider);
  const storageKey = typeof data['storage_key'] === 'string' ? data['storage_key'] : '';
  const externalId =
    typeof data['external_object_id'] === 'string' ? data['external_object_id'] : null;
  const mimeType =
    typeof data['mime_type'] === 'string' ? data['mime_type'] : 'application/octet-stream';
  const fileName = item.fileName ?? 'attachment';

  await service.rpc('record_file_access', {
    p_file_id: item.fileId,
    p_action: 'download',
    p_document_link_id: null,
    p_ip_hash: requestContext.ipHash,
    p_user_agent: requestContext.userAgent,
    p_was_allowed: true,
    p_denial_reason: null,
  });

  try {
    if (adapter.streamObject !== undefined) {
      const streamed = await adapter.streamObject(target, externalId ?? storageKey);

      if (streamed === null || streamed.body === null) {
        return errorResponse(
          'That attachment is no longer available.',
          HTTP_STATUS.notFound,
          'not_found'
        );
      }

      return new NextResponse(streamed.body, {
        status: HTTP_STATUS.ok,
        headers: {
          'content-type': mimeType,
          'content-disposition': `inline; filename="${fileName.replace(/"/g, '')}"`,
          'cache-control': 'private, no-store',
          'referrer-policy': 'no-referrer',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    const url = await adapter.createDownloadUrl(target, storageKey, fileName);
    const response = NextResponse.redirect(url, { status: HTTP_STATUS.temporaryRedirect });

    response.headers.set('cache-control', 'no-store');
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');

    return response;
  } catch (cause) {
    logger.error('A delivered file could not be served', cause, { fileId: item.fileId });

    return errorResponse(
      'That attachment could not be opened right now.',
      HTTP_STATUS.serverError,
      'integration_failure'
    );
  }
}
