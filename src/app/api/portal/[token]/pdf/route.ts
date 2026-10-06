// src/app/api/portal/[token]/pdf/route.ts
// Downloading the document behind a client link as a PDF. The token is the
// only credential, and the same rules that guard the page guard the file.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { portalDocumentToPdf, portalFileName } from '@/features/portal/export';
import { resolvePortalDocument } from '@/features/portal/queries/resolve-portal-document';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export interface PortalPdfContext {
  /** Route parameters of the request. */
  params: { token: string };
}

/**
 * Answers a download request made from a client link.
 *
 * @param _request Incoming request.
 * @param context Route parameters of the request.
 * @returns The PDF, or an explanation in the usual shape.
 */
export async function GET(_request: NextRequest, context: PortalPdfContext): Promise<NextResponse> {
  const result = await resolvePortalDocument(decodeURIComponent(context.params.token));

  if (!result.isAvailable) {
    return errorResponse(result.message, HTTP_STATUS.notFound, 'not_found');
  }

  const file = portalDocumentToPdf(result.document);

  return new NextResponse(Buffer.from(file), {
    status: HTTP_STATUS.ok,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${portalFileName(result.document)}"`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}
