// src/app/api/storage/files/[providerFileId]/route.ts
// Serves private Drive files only after verifying the application signature
// and the tenant/file relationship. The Drive service-account token never
// leaves this server route.
import { Readable } from 'node:stream';

import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/env/env.server';
import { StorageProviderError } from '@/lib/storage/errors';
import {
  GoogleDriveStorageAdapter,
  createStorageAdapter,
  verifyGoogleDriveApplicationSignature,
} from '@/lib/storage';

function errorResponse(status: number): NextResponse {
  return NextResponse.json({ error: 'The requested file is not available.' }, { status });
}

function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  request: Request,
  context: { params: { providerFileId: string } }
): Promise<Response> {
  const url = new URL(request.url);
  const companyId = url.searchParams.get('company_id');
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');
  const expiresAt = expires ? Number(expires) : NaN;

  if (
    !companyId ||
    !signature ||
    !Number.isSafeInteger(expiresAt) ||
    !verifyGoogleDriveApplicationSignature({
      signingSecret: serverEnv.LINK_SIGNING_SECRET,
      companyId,
      providerFileId: context.params.providerFileId,
      expiresAt,
      signature,
    })
  ) {
    return errorResponse(403);
  }

  try {
    const adapter = createStorageAdapter();
    if (!(adapter instanceof GoogleDriveStorageAdapter)) {
      return errorResponse(404);
    }

    const download = await adapter.downloadFile(companyId, context.params.providerFileId);
    const body = Readable.toWeb(download.body as Readable) as ReadableStream<Uint8Array>;

    return new Response(body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition(download.fileName),
        'Content-Length': String(download.sizeInBytes),
        'Content-Type': download.mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof StorageProviderError) {
      return error.code === 'tenant_scope_denied' ? errorResponse(403) : errorResponse(404);
    }
    return errorResponse(404);
  }
}
