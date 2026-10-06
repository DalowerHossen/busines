// src/app/api/files/local/route.ts
// Reading and writing files when they are kept on this server.
//
// A self hosted installation has no object store to sign an address with,
// so this route plays that part. The permission is a short lived signature
// over the key, which means a leaked address stops working on its own and
// cannot be pointed at anybody else's file.

import { NextResponse, type NextRequest } from 'next/server';

import { readFile } from 'node:fs/promises';

import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import {
  localGrantIsValid,
  localPathFor,
  writeLocalObject,
} from '@/lib/storage/adapters/local-disk';

export const dynamic = 'force-dynamic';

/** Largest body this route will take in one request. */
const MAX_BYTES = 100 * 1024 * 1024;

interface LocalGrant {
  storageKey: string;
  action: string;
  downloadName: string | null;
}

/**
 * Checks the permission carried in the address.
 *
 * @param request Incoming request.
 * @param expectedAction What the caller is trying to do.
 * @returns The grant, or null when it is not good.
 */
function readGrant(request: NextRequest, expectedAction: string): LocalGrant | null {
  const parameters = request.nextUrl.searchParams;
  const storageKey = parameters.get('key');
  const action = parameters.get('action');
  const expires = Number.parseInt(parameters.get('expires') ?? '', 10);
  const signature = parameters.get('signature');

  if (storageKey === null || action === null || signature === null || action !== expectedAction) {
    return null;
  }

  if (!localGrantIsValid(storageKey, action, expires, signature)) {
    return null;
  }

  return { storageKey, action, downloadName: parameters.get('download') };
}

/**
 * Accepts the bytes of one file.
 *
 * @param request Incoming request.
 * @returns What was stored, or an explanation in the usual shape.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const grant = readGrant(request, 'write');

  if (grant === null) {
    return errorResponse(
      'That upload address is not valid any more.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const body = await request.arrayBuffer();

  if (body.byteLength === 0) {
    return errorResponse('No file was sent.', HTTP_STATUS.badRequest, 'validation_failed');
  }

  if (body.byteLength > MAX_BYTES) {
    return errorResponse(
      'That file is larger than this server accepts in one piece.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  try {
    const written = await writeLocalObject(grant.storageKey, Buffer.from(body));

    return NextResponse.json(
      { stored: true, byte_size: written },
      { status: HTTP_STATUS.created, headers: { 'cache-control': 'no-store' } }
    );
  } catch (cause) {
    logger.error('A file could not be written to this server', cause);

    return errorResponse(
      'This server could not store that file.',
      HTTP_STATUS.serverError,
      'integration_failure'
    );
  }
}

/**
 * Serves the bytes of one file.
 *
 * @param request Incoming request.
 * @returns The file, or an explanation in the usual shape.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const grant = readGrant(request, 'read');

  if (grant === null) {
    return errorResponse(
      'That file address is not valid any more.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  try {
    const content = await readFile(localPathFor(grant.storageKey));
    const disposition =
      grant.downloadName === null
        ? 'inline'
        : `attachment; filename="${grant.downloadName.replace(/"/g, '')}"`;

    return new NextResponse(content, {
      status: HTTP_STATUS.ok,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': disposition,
        'cache-control': 'private, no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch {
    return errorResponse('That file is not on this server.', HTTP_STATUS.notFound, 'not_found');
  }
}
