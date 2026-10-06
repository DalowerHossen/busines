// src/lib/security/request-context.ts
// Reads the facts about a request that belong in an audit entry: where it came
// from, what made it and which request it was. The address is only ever stored
// as a hash.

import 'server-only';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

export interface RequestContext {
  ipAddress: string | null;
  ipHash: string | null;
  userAgent: string | null;
  requestId: string | null;
  origin: string | null;
}

/**
 * Picks the caller address out of the forwarding headers.
 *
 * @param headerList Headers of the current request.
 * @returns The address, or null when no proxy supplied one.
 */
function readIpAddress(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for');

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();

    if (first && first.length > 0) {
      return first;
    }
  }

  return headerList.get('x-real-ip') ?? headerList.get('cf-connecting-ip');
}

/**
 * Hashes an address so it can be compared without being stored in the clear.
 *
 * @param ipAddress Address of the caller.
 * @returns The hash as lowercase hexadecimal, or null when there is no address.
 */
export function hashIpAddress(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null;
  }

  return createHash('sha256').update(ipAddress, 'utf8').digest('hex');
}

/**
 * Reads the context of the current request.
 *
 * @returns Where the request came from and what made it.
 */
export function getRequestContext(): RequestContext {
  const headerList = headers() as unknown as Headers;
  const ipAddress = readIpAddress(headerList);

  return {
    ipAddress,
    ipHash: hashIpAddress(ipAddress),
    userAgent: headerList.get('user-agent'),
    requestId: headerList.get('x-request-id'),
    origin: headerList.get('origin'),
  };
}

/**
 * Reads the context of a request the caller already holds, for route handlers
 * and the middleware.
 *
 * @param request Incoming request.
 * @returns Where the request came from and what made it.
 */
export function contextFromRequest(request: Request): RequestContext {
  const ipAddress = readIpAddress(request.headers);

  return {
    ipAddress,
    ipHash: hashIpAddress(ipAddress),
    userAgent: request.headers.get('user-agent'),
    requestId: request.headers.get('x-request-id'),
    origin: request.headers.get('origin'),
  };
}
