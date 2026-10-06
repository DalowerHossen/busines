// src/lib/storage/signing.ts
// Signing a request the way object stores expect.
//
// Every store worth using speaks the same signing scheme, so one small
// implementation covers the managed object stores, the cheap ones and the
// enterprise one. It is written out rather than pulled in as a dependency
// because the whole of what we need is a presigned address.

import 'server-only';

import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

export interface PresignRequest {
  method: 'GET' | 'PUT' | 'DELETE';
  host: string;
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  /** Extra query parameters, such as a download name. */
  query?: Readonly<Record<string, string>>;
  /** Headers that have to be signed as well as sent. */
  signedHeaders?: Readonly<Record<string, string>>;
}

/**
 * Encodes one path segment the way the signing scheme expects.
 *
 * @param value Segment being encoded.
 * @returns The encoded segment.
 */
function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).toUpperCase();

    return `%${code}`;
  });
}

/**
 * Encodes a whole key, keeping the slashes between its segments.
 *
 * @param path Key being encoded.
 * @returns The encoded path, beginning with a slash.
 */
function encodePath(path: string): string {
  return `/${path
    .split('/')
    .filter((segment) => segment !== '')
    .map(encodeSegment)
    .join('/')}`;
}

/**
 * Builds the two timestamps the signing scheme uses.
 *
 * @param now The moment the request is signed.
 * @returns The long and short forms of the timestamp.
 */
function timestamps(now: Date): { amazonDate: string; shortDate: string } {
  const amazonDate = `${now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')
    .slice(0, 15)}Z`;

  return { amazonDate, shortDate: amazonDate.slice(0, 8) };
}

/**
 * Derives the key the request is signed with.
 *
 * @param secretAccessKey Secret half of the credentials.
 * @param shortDate Date the signature is valid for.
 * @param region Region of the store.
 * @returns The derived signing key.
 */
function signingKey(secretAccessKey: string, shortDate: string, region: string): Buffer {
  const dateKey = createHmac('sha256', `AWS4${secretAccessKey}`).update(shortDate).digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();

  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

/**
 * Builds a presigned address for one object.
 *
 * @param request What is being signed and for how long.
 * @returns The address, complete with its signature.
 */
export function presignObjectUrl(request: PresignRequest): string {
  const now = new Date();
  const { amazonDate, shortDate } = timestamps(now);
  const scope = `${shortDate}/${request.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: request.host, ...request.signedHeaders };
  const headerNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${String(headers[name] ?? headers[name.toLowerCase()]).trim()}\n`)
    .join('');
  const signedHeaderList = headerNames.join(';');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${request.accessKeyId}/${scope}`,
    'X-Amz-Date': amazonDate,
    'X-Amz-Expires': String(request.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaderList,
    ...request.query,
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encodeSegment(name)}=${encodeSegment(String(query[name]))}`)
    .join('&');

  const canonicalRequest = [
    request.method,
    encodePath(request.path),
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    UNSIGNED_PAYLOAD,
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amazonDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signature = createHmac(
    'sha256',
    signingKey(request.secretAccessKey, shortDate, request.region)
  )
    .update(stringToSign)
    .digest('hex');

  return `https://${request.host}${encodePath(request.path)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
